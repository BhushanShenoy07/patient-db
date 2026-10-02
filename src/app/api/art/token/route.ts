import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { issueAccessToken } from "@/lib/art";

export const runtime = "nodejs";

/**
 * The browser ADK's /auth/token request is routed here (see lib/art-client.ts).
 * The response mirrors ART's own shape so the ADK can use it unchanged.
 *
 * ART issues no refresh token for passcode logins, and the ADK crashes on
 * reconnect when the refresh token is missing. "server-managed.0" reads as an
 * already-expired refresh token, so the ADK asks this route for a new access
 * token on every reconnect instead.
 */
export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ message: "Sign in to connect to ART." }, { status: 401 });
  try {
    const accessToken = await issueAccessToken(session);
    return NextResponse.json(
      {
        status: 200,
        data: {
          access_token: accessToken,
          refresh_token: "server-managed.0",
          username: session.artUsername,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not issue an ART token.";
    console.error(`[ART] Token for "${session.artUsername}" failed:`, message);
    return NextResponse.json({ message }, { status: 502 });
  }
}
