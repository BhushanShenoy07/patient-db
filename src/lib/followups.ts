import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = () => {
  const secret = process.env.CLINIC_SESSION_SECRET?.trim();
  const validSecret = (!secret || secret.length < 32 || secret === "xxx")
    ? "clinic-desk-super-secure-production-fallback-session-secret-key-32-chars"
    : secret;
  return createHash("sha256").update(validSecret).digest();
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

export function hasFreshdeskConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();
  return Boolean(domain && domain !== "xxx" && /^[a-z0-9-]+\.freshdesk\.com$/i.test(domain) && apiKey && apiKey !== "xxx");
}

export function hasFreshserviceConfig() {
  const domain = process.env.FRESHSERVICE_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHSERVICE_API_KEY?.trim();
  return Boolean(domain && domain !== "xxx" && /^[a-z0-9-]+\.freshservice\.com$/i.test(domain) && apiKey && apiKey !== "xxx");
}

function freshdeskConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();
  if (!domain || !apiKey || domain === "xxx" || apiKey === "xxx" || !/^[a-z0-9-]+\.freshdesk\.com$/i.test(domain)) {
    throw new Error("Configure FRESHDESK_DOMAIN and FRESHDESK_API_KEY on the server.");
  }
  return { base: `https://${domain}/api/v2`, authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}` };
}

function freshserviceConfig() {
  const domain = process.env.FRESHSERVICE_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiKey = process.env.FRESHSERVICE_API_KEY?.trim();
  if (!domain || !apiKey || domain === "xxx" || apiKey === "xxx" || !/^[a-z0-9-]+\.freshservice\.com$/i.test(domain)) {
    throw new Error("Configure FRESHSERVICE_DOMAIN and FRESHSERVICE_API_KEY on the server.");
  }
  return { base: `https://${domain}/api/v2`, authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}` };
}

// In-memory fallback tickets store
interface LocalTicket {
  id: number | string;
  name: string;
  email: string;
  subject: string;
  description: string;
  description_text: string;
  created_at: string;
  priority: number;
  tags: string[];
}

const localTickets: LocalTicket[] = [
  {
    id: 101,
    name: "Rajesh Kumar",
    email: "rajesh.kumar@example.com",
    subject: "Clinic Desk · HEALTH CHANGE REPORTED · Rajesh Kumar",
    description: "<p><strong>Patient:</strong> Rajesh Kumar</p><p><strong>Doctor:</strong> Dr. Neha Sharma</p><p><strong>Doctor rating:</strong> 4/5 stars</p><p><strong>Clinic service rating:</strong> 4/5 stars</p><p><strong>Health change reported:</strong> Yes</p><p><strong>Patient update:</strong> Mild fever returned in the evening, taking prescribed paracetamol as advised.</p>",
    description_text: "Doctor: Dr. Neha Sharma | Doctor rating: 4/5 | Service rating: 4/5 | Health change: YES | Patient update: Mild fever returned in the evening, taking prescribed paracetamol as advised.",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    priority: 4, // High / Urgent
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt003"],
  },
  {
    id: 102,
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    subject: "Clinic Desk · Patient follow-up feedback · Aarav Sharma",
    description: "<p><strong>Patient:</strong> Aarav Sharma</p><p><strong>Doctor:</strong> Dr. Ananya Rao</p><p><strong>Doctor rating:</strong> 5/5 stars</p><p><strong>Clinic service rating:</strong> 5/5 stars</p><p><strong>Health change reported:</strong> No</p><p><strong>Patient update:</strong> Feeling much better after the medication. The Zoom consultation was very smooth.</p>",
    description_text: "Doctor: Dr. Ananya Rao | Doctor rating: 5/5 | Service rating: 5/5 | Health change: No | Patient update: Feeling much better after the medication. The Zoom consultation was very smooth.",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    priority: 1,
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt001"],
  },
  {
    id: 103,
    name: "Priya Nair",
    email: "priya.nair@example.com",
    subject: "Clinic Desk · Patient follow-up feedback · Priya Nair",
    description: "<p><strong>Patient:</strong> Priya Nair</p><p><strong>Doctor:</strong> Dr. Rohan Nair</p><p><strong>Doctor rating:</strong> 5/5 stars</p><p><strong>Clinic service rating:</strong> 5/5 stars</p><p><strong>Health change reported:</strong> No</p><p><strong>Patient update:</strong> Knee pain is resolving well with the prescribed physiotherapy exercises.</p>",
    description_text: "Doctor: Dr. Rohan Nair | Doctor rating: 5/5 | Service rating: 5/5 | Health change: No | Patient update: Knee pain is resolving well with the prescribed exercises.",
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    priority: 1,
    tags: ["clinic_health_update", "clinic_followup_response", "appointment_recAppt004"],
  },
];

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

export async function freshserviceRequest(path: string, init: RequestInit = {}) {
  const config = freshserviceConfig();
  const response = await fetch(`${config.base}${path}`, { ...init, headers: { Authorization: config.authorization, "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (response.status === 401) {
    throw new Error("Freshservice rejected the API key. Set FRESHSERVICE_API_KEY to an active agent API key.");
  }
  if (!response.ok) {
    throw new Error(body.description || body.message || `Freshservice request failed (${response.status})`);
  }
  return body;
}

export async function createFreshserviceTicket(input: { email: string; subject: string; description: string; priority?: number }) {
  if (hasFreshserviceConfig()) {
    try {
      return await freshserviceRequest("/tickets", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          subject: input.subject,
          description: input.description,
          priority: input.priority || 1,
          status: 2,
        }),
      });
    } catch (e) {
      console.warn("Freshservice ticket creation notice:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

export async function createFollowupTicket(input: {
  email: string;
  name: string;
  subject: string;
  description: string;
  tags: string[];
  priority?: number;
  ccEmails?: string[];
}) {
  const cleanRequesterEmail = input.email.trim().toLowerCase();
  const safeCc = (input.ccEmails || [])
    .map(e => e.trim().toLowerCase())
    .filter(e => e && e !== cleanRequesterEmail && /^\S+@\S+\.\S+$/.test(e));
  const uniqueCc = Array.from(new Set(safeCc));

  let freshdeskResult = null;

  if (hasFreshdeskConfig()) {
    const buildPayload = (includeCompany: boolean) => {
      const companyVal = process.env.FRESHDESK_COMPANY_ID?.trim();
      const numComp = companyVal && !isNaN(Number(companyVal)) ? Number(companyVal) : null;
      return {
        email: cleanRequesterEmail,
        name: input.name.trim(),
        subject: input.subject,
        description: input.description,
        priority: input.priority || 1,
        status: 2,
        source: 2,
        responder_id: 1130009360826, // Assign Receptionist agent so customer replies notify the receptionist!
        tags: input.tags,
        ...(uniqueCc.length ? { cc_emails: uniqueCc } : {}),
        ...(includeCompany && numComp ? { company_id: numComp } : {}),
      };
    };

    try {
      // First attempt without forcing company_id to avoid "requester does not belong to specified company" errors
      freshdeskResult = await freshdeskRequest("/tickets", {
        method: "POST",
        body: JSON.stringify(buildPayload(false)),
      });
    } catch (e) {
      console.warn("Freshdesk ticket creation failed:", e instanceof Error ? e.message : e);
      throw e;
    }
  }

  // Also sync ticket record to Freshservice if configured
  let freshserviceResult = null;
  if (hasFreshserviceConfig()) {
    freshserviceResult = await createFreshserviceTicket({
      email: cleanRequesterEmail,
      subject: input.subject,
      description: input.description,
      priority: input.priority || 1,
    });
  }

  if (freshdeskResult) {
    return { ...freshdeskResult, freshserviceTicketId: freshserviceResult?.ticket?.id || freshserviceResult?.id };
  }

  if (freshserviceResult) {
    return { id: freshserviceResult.ticket?.id || freshserviceResult.id, simulated: false };
  }

  // Fallback local ticket if neither helpdesk is configured
  const newTicket: LocalTicket = {
    id: Math.floor(1000 + Math.random() * 9000),
    name: input.name,
    email: input.email,
    subject: input.subject,
    description: input.description,
    description_text: input.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    created_at: new Date().toISOString(),
    priority: input.priority || 1,
    tags: input.tags,
  };
  localTickets.unshift(newTicket);
  return { id: newTicket.id, simulated: true };
}

let ticketsCache: any[] = [];
let ticketsCacheTime = 0;
const TICKETS_CACHE_TTL = 20_000; // 20s cache window to protect Freshdesk 50 req/min limit
const conversationCache = new Map<string, { updatedAt: string; conversations: any[] }>();

export function invalidateTicketsCache() {
  ticketsCacheTime = 0;
}

export async function getClinicTicketsWithConversations(limit = 30) {
  if (!hasFreshdeskConfig()) {
    return localTickets.map(t => ({
      id: String(t.id),
      subject: t.subject,
      email: t.email,
      name: t.name,
      status: 2,
      priority: t.priority,
      message: t.description_text || t.description,
      createdAt: t.created_at,
      updatedAt: t.created_at,
      responderId: 1130009360826,
      tags: t.tags,
      conversations: [],
    }));
  }

  const logDebug = (msg: string) => {
    try {
      const fs = require("fs");
      const path = require("path");
      fs.appendFileSync("scratch/debug_server.log", `[${new Date().toISOString()}] ${msg}\n`);
    } catch {}
  };

  logDebug(`Called getClinicTicketsWithConversations. Cached: ${ticketsCache.length}, CacheAge: ${Date.now() - ticketsCacheTime}ms`);

  const now = Date.now();
  if (ticketsCache.length > 0 && now - ticketsCacheTime < TICKETS_CACHE_TTL) {
    logDebug(`Serving from memory cache: ${ticketsCache.length} items`);
    return ticketsCache;
  }

  try {
    let tickets: any = null;
    try {
      tickets = await freshdeskRequest(`/tickets?order_by=updated_at&order_type=desc&per_page=${limit}&include=requester`);
      logDebug(`Freshdesk API returned: isArray=${Array.isArray(tickets)}, length=${Array.isArray(tickets) ? tickets.length : typeof tickets}`);
    } catch (reqErr: any) {
      logDebug(`Freshdesk API threw error: ${reqErr?.message || reqErr}`);
      if (reqErr?.message?.includes("429") || String(reqErr).includes("429")) {
        if (ticketsCache.length > 0) {
          logDebug(`429 caught; serving cached: ${ticketsCache.length}`);
          return ticketsCache;
        }
      }
      throw reqErr;
    }

    if (!Array.isArray(tickets)) {
      if (ticketsCache.length > 0) return ticketsCache;
      return [];
    }

    let convCalls = 0;
    const enriched = await Promise.all(
      tickets.map(async (t: any) => {
        let conversations: any[] = [];
        const hasUpdates = t.created_at !== t.updated_at;

        if (hasUpdates) {
          const cached = conversationCache.get(String(t.id));
          if (cached && cached.updatedAt === t.updated_at) {
            conversations = cached.conversations;
          } else if (convCalls < 5) {
            convCalls++;
            try {
              const convRes = await freshdeskRequest(`/tickets/${t.id}/conversations`);
              if (Array.isArray(convRes)) {
                conversations = convRes.map((c: any) => ({
                  id: String(c.id),
                  incoming: Boolean(c.incoming),
                  from: c.from_email || (c.incoming ? (t.requester?.name || "Patient / Doctor") : "Reception Desk Staff"),
                  message: (c.body_text || c.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
                  createdAt: c.created_at,
                }));
              }
            } catch { /* ignore individual conversation fetch */ }
            conversationCache.set(String(t.id), { updatedAt: t.updated_at, conversations });
          }
        }

        const requester = t.requester || {};
        const cleanBody = (t.description_text || t.description || "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        return {
          id: String(t.id),
          subject: t.subject || "Clinic Consultation",
          email: requester.email || t.email || "",
          name: requester.name || t.name || "Patient / Physician",
          status: Number(t.status || 2),
          priority: Number(t.priority || 1),
          message: cleanBody.slice(0, 500),
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          responderId: t.responder_id,
          tags: Array.isArray(t.tags) ? t.tags : [],
          conversations,
        };
      })
    );

    ticketsCache = enriched;
    ticketsCacheTime = Date.now();
    return enriched;
  } catch (err) {
    console.warn("Could not load Freshdesk tickets:", err);
    if (ticketsCache.length > 0) return ticketsCache;
    return [];
  }
}

export async function replyToFreshdeskTicket(ticketId: number | string, replyMessage: string) {
  invalidateTicketsCache();
  if (!hasFreshdeskConfig()) {
    const existing = localTickets.find(t => String(t.id) === String(ticketId));
    if (existing) {
      existing.description_text += `\n[Staff Reply]: ${replyMessage}`;
    }
    return { id: Date.now(), simulated: true };
  }

  const cleanId = String(ticketId).replace(/[^0-9]/g, "");
  if (!cleanId) throw new Error("Invalid ticket ID for reply.");

  const formattedBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b;"><p>${escapeHtml(replyMessage).replace(/\n/g, "<br/>")}</p><p style="margin-top: 16px; font-size: 12px; color: #64748b;">— Clinic Reception Desk</p></div>`;

  return await freshdeskRequest(`/tickets/${cleanId}/reply`, {
    method: "POST",
    body: JSON.stringify({ body: formattedBody }),
  });
}

export async function searchFollowupTickets(tag: string) {
  if (hasFreshdeskConfig()) {
    try {
      const query = encodeURIComponent(`"tag:'${tag.replace(/'/g, "\\'")}'"`);
      return await freshdeskRequest(`/search/tickets?query=${query}`);
    } catch (e) {
      console.warn("Freshdesk search failed; returning local inbox tickets:", e instanceof Error ? e.message : e);
    }
  }

  // Return local tickets matching tag
  const matching = localTickets.filter(t => t.tags.includes(tag));
  return { results: matching };
}
