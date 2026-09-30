import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = () => {
  const secret = process.env.CLINIC_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Set CLINIC_SESSION_SECRET to a random value of at least 32 characters.");
  return createHash("sha256").update(secret).digest();
};

export type FollowupToken = { name: string; email: string; doctor: string; appointmentId: string; expiresAt: number };
export type AppointmentActionToken = { appointmentId: string; name: string; email: string; doctor: string; doctorEmail: string; date: string; time: string; mode: string; zoomId?: string; zoomUrl?: string; expiresAt: number };

export function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

export function createFollowupToken(data: Omit<FollowupToken, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function readFollowupToken(token: string): FollowupToken | null {
  try {
    const [ivText, tagText, encryptedText] = token.split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
    const data = JSON.parse(plaintext.toString("utf8")) as FollowupToken;
    return data.name && data.email && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
}

export function createAppointmentActionToken(data: Omit<AppointmentActionToken, "expiresAt">) {
  const appointmentEnd = new Date(`${data.date}T23:59:59`).getTime() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: Math.max(Date.now() + 30 * 24 * 60 * 60 * 1000, appointmentEnd) }));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function readAppointmentActionToken(token: string): AppointmentActionToken | null {
  try {
    const [ivText, tagText, encryptedText] = token.split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
    const data = JSON.parse(plaintext.toString("utf8")) as AppointmentActionToken;
    return data.appointmentId && data.email && data.doctorEmail && data.expiresAt > Date.now() ? data : null;
  } catch { return null; }
}

function freshdeskConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHDESK_API_KEY;
  if (!domain || !apiKey || !/^[a-z0-9-]+\.freshdesk\.com$/i.test(domain)) {
    throw new Error("Configure FRESHDESK_DOMAIN and FRESHDESK_API_KEY on the server.");
  }
  return { base: `https://${domain}/api/v2`, authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}` };
}

export async function freshdeskRequest(path: string, init: RequestInit = {}) {
  const config = freshdeskConfig();
  const response = await fetch(`${config.base}${path}`, { ...init, headers: { Authorization: config.authorization, "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (response.status === 401) {
    throw new Error("Freshdesk rejected the API key. Set FRESHDESK_API_KEY to an active agent API key from the profile for the configured Freshdesk account.");
  }
  if (response.status === 403) {
    throw new Error("Freshdesk authenticated the API key but denied ticket access. Check the Freshdesk agent permissions.");
  }
  if (!response.ok) {
    const fieldErrors = Array.isArray(body.errors)
      ? body.errors.map((item: any) => [item.field, item.message || item.code].filter(Boolean).join(": ")).filter(Boolean)
      : body.errors && typeof body.errors === "object"
        ? Object.entries(body.errors).flatMap(([field, details]) => (Array.isArray(details) ? details : [details]).map(detail => `${field}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`))
        : [];
    const detail = fieldErrors.length ? `${body.description || body.message || "Validation failed"} — ${fieldErrors.join("; ")}` : body.description || body.message || `Freshdesk request failed (${response.status}).`;
    throw new Error(String(detail).slice(0, 1000));
  }
  return body;
}

export async function createFollowupTicket(input: { email: string; name: string; subject: string; description: string; tags: string[]; priority?: number; ccEmails?: string[] }) {
  return freshdeskRequest("/tickets", { method: "POST", body: JSON.stringify({ email: input.email, name: input.name, subject: input.subject, description: input.description, priority: input.priority || 1, status: 2, source: 2, tags: input.tags, ...(input.ccEmails?.length ? { cc_emails: input.ccEmails } : {}) }) });
}

export async function searchFollowupTickets(tag: string) {
  // Freshdesk requires the complete search expression to be quoted before URL encoding.
  const query = encodeURIComponent(`"tag:'${tag.replace(/'/g, "\\'")}'"`);
  return freshdeskRequest(`/search/tickets?query=${query}`);
}
