import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";

export const runtime = "nodejs";

type Context = { params: { path: string[] } };

async function callZoom(request: Request, context: Context) {
  if (!readClinicSession(request)) {
    return NextResponse.json({ error: "Sign in before managing Zoom meetings." }, { status: 401 });
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const userId = process.env.ZOOM_USER_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const missing = [
    ["ZOOM_ACCOUNT_ID", accountId],
    ["ZOOM_USER_ID", userId],
    ["ZOOM_CLIENT_ID", clientId],
    ["ZOOM_CLIENT_SECRET", clientSecret],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    return NextResponse.json({ error: `Zoom is not configured on the server. Add ${missing.join(", ")} to the server environment and restart the app.` }, { status: 503 });
  }

  const segments = context.params.path || [];
  if (segments[0] !== "meetings" || segments.length > 2) {
    return NextResponse.json({ error: "Unsupported Zoom operation." }, { status: 404 });
  }
  const method = request.method;
  if ((method === "POST" && segments.length !== 1) || (method !== "POST" && (segments.length !== 2 || !["PATCH", "DELETE"].includes(method)))) {
    return NextResponse.json({ error: "Unsupported Zoom operation." }, { status: 405 });
  }

  try {
    const requestText = await request.text();
    let zoomRequest: Record<string, unknown> = {};
    try { zoomRequest = requestText ? JSON.parse(requestText) : {}; } catch { return NextResponse.json({ error: "Invalid Zoom request." }, { status: 400 }); }
    if (zoomRequest.appointmentMode !== "Online") return NextResponse.json({ error: "Zoom is available only for online appointments." }, { status: 400 });

    const tokenResponse = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "account_credentials", account_id: accountId! }),
      cache: "no-store",
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof tokenData.access_token !== "string") {
      const reason = tokenData.reason || tokenData.message || "Zoom could not issue an access token. Check that these are Server-to-Server OAuth app credentials.";
      return NextResponse.json({ error: `Zoom authentication failed: ${reason}` }, { status: 502 });
    }

    const meetingPath = segments.length === 1
      ? `/accounts/${encodeURIComponent(accountId!)}/users/${encodeURIComponent(userId!)}/meetings`
      : `/accounts/${encodeURIComponent(accountId!)}/meetings/${encodeURIComponent(segments[1])}`;
    const url = `https://api.zoom.us/v2${meetingPath}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${tokenData.access_token}` };
    let body: string | undefined = undefined;
    if (method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      const { appointmentMode: _appointmentMode, ...zoomPayload } = zoomRequest;
      body = JSON.stringify(zoomPayload);
    }
    const response = await fetch(url, { method, headers, body, cache: "no-store" });
    const text = await response.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!response.ok && typeof data === "object" && data !== null) {
      const zoomError = data as { code?: unknown; message?: unknown };
      if (String(zoomError.code) === "4711" && typeof zoomError.message === "string" && zoomError.message.includes("meeting:write:meeting:master")) {
        return NextResponse.json({
          error: "Zoom issued a token without meeting:write:meeting:master. Add and save that exact scope on the Server-to-Server OAuth app used by this server, activate or reactivate the app, then ensure ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET belong to that app. A meeting:write:meeting:admin grant does not replace the master scope for this account-level endpoint.",
          code: 4711,
        }, { status: response.status });
      }
      if (String(zoomError.code) === "1001") {
        return NextResponse.json({
          error: "Zoom could not find the configured meeting host under this Zoom account. Set ZOOM_USER_ID to the licensed host's Zoom user ID or email from the same account as ZOOM_ACCOUNT_ID.",
          code: 1001,
        }, { status: response.status });
      }
    }
    if (response.status === 404) {
      return NextResponse.json({
        error: "Zoom returned 404 for the account-level meeting request. Check that ZOOM_ACCOUNT_ID belongs to the configured Server-to-Server OAuth app and ZOOM_USER_ID identifies a licensed meeting host in that same account.",
        code: typeof data === "object" && data !== null && "code" in data ? (data as { code?: unknown }).code : undefined,
      }, { status: response.status });
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Zoom request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not connect to Zoom. Check the server network and Zoom app configuration." }, { status: 502 });
  }
}

export const POST = callZoom;
export const PATCH = callZoom;
export const DELETE = callZoom;
