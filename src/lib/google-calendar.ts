import { createPrivateKey, createSign } from "node:crypto";

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

async function accessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!email || !rawKey) throw new Error("Configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY on the server.");
  let keyText = rawKey;
  if (keyText.startsWith('"') && keyText.endsWith('"')) {
    try { keyText = JSON.parse(keyText); }
    catch { keyText = keyText.slice(1, -1); }
  } else if (keyText.startsWith("'") && keyText.endsWith("'")) keyText = keyText.slice(1, -1);
  if (keyText.startsWith("{")) {
    try {
      const credentials = JSON.parse(keyText);
      if (typeof credentials.private_key === "string") keyText = credentials.private_key;
    } catch { /* Continue with the supplied PEM text for a clear validation error below. */ }
  }
  keyText = keyText.replace(/\\+n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!keyText.includes("-----BEGIN PRIVATE KEY-----")) {
    const decoded = Buffer.from(keyText, "base64").toString("utf8").trim();
    if (decoded.startsWith("{")) {
      try {
        const credentials = JSON.parse(decoded);
        if (typeof credentials.private_key === "string") keyText = credentials.private_key.replace(/\\+n/g, "\n").trim();
      } catch { /* Report the invalid key using the normal validation path. */ }
    } else if (decoded.includes("-----BEGIN PRIVATE KEY-----")) keyText = decoded.replace(/\\+n/g, "\n").trim();
  }
  let privateKey: ReturnType<typeof createPrivateKey>;
  try {
    if (keyText.includes("-----BEGIN PRIVATE KEY-----")) {
      privateKey = createPrivateKey(keyText);
    } else {
      const der = Buffer.from(keyText.replace(/\s+/g, ""), "base64");
      privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
    }
  } catch {
    throw new Error("GOOGLE_PRIVATE_KEY is invalid. Set it to the full PEM private_key from the service-account JSON, or to a base64-encoded PKCS#8 DER key.");
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/calendar", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`Google Calendar authentication failed: ${body.error_description || body.error || response.status}`);
  return body.access_token as string;
}

export async function calendarRequest(method: string, eventId: string | null, event?: Record<string, unknown>) {
  const configuredId = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
  const calendarId =
    (!configuredId || configuredId === "xxx" || (!configuredId.includes("@") && configuredId !== "primary"))
      ? "primary"
      : configuredId;
  const token = await accessToken();

  const executeCall = async (targetCal: string) => {
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCal)}/events`;
    const url = eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
    return await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(event ? { body: JSON.stringify(event) } : {}),
    });
  };

  let response = await executeCall(calendarId);
  if (response.status === 404 && calendarId !== "primary") {
    response = await executeCall("primary");
  }
  if (response.status === 204) return { ok: true };
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Google Calendar request failed (${response.status}).`);
  return body;
}
