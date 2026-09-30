import { createHmac, timingSafeEqual } from "node:crypto";

export type ClinicRole = "doctor" | "receptionist";
export type ClinicSession = { email: string; role: ClinicRole; name: string; doctorName?: string; expiresAt: number };
type ClinicAccount = { email: string; password: string; role: ClinicRole; name: string; doctorName?: string };

export const CLINIC_DOCTORS = [
  { name: "Dr. Ananya Rao", specialization: "General Medicine" },
  { name: "Dr. Arjun Mehta", specialization: "Cardiology" },
  { name: "Dr. Neha Sharma", specialization: "Dermatology" },
  { name: "Dr. Rohan Nair", specialization: "Orthopedics" },
  { name: "Dr. Priya Menon", specialization: "Pediatrics" },
  { name: "Dr. Karan Iyer", specialization: "Neurology" },
  { name: "Dr. Sneha Kapoor", specialization: "Gynecology" },
  { name: "Dr. Vikram Shetty", specialization: "Ophthalmology" },
  { name: "Dr. Aisha Khan", specialization: "ENT" },
  { name: "Dr. Rahul Desai", specialization: "Gastroenterology" },
  { name: "Dr. Bhushan Shenoy", specialization: "Clinic Doctor" },
] as const;

const normalizeDoctor = (name?: string) => (name || "").trim().toLowerCase().replace(/^dr\.?\s*/, "");

export const SESSION_COOKIE = "clinic_session";
const SESSION_SECONDS = 8 * 60 * 60;

export function loadClinicAccounts(): ClinicAccount[] {
  const raw = process.env.CLINIC_USERS_JSON;
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("CLINIC_USERS_JSON must be a JSON array of accounts.");
  return parsed.map((account: any) => {
    const role = account?.role;
    if (typeof account?.email !== "string" || typeof account?.password !== "string" || !["doctor", "receptionist"].includes(role) || typeof account?.name !== "string") {
      throw new Error("Each clinic account needs email, password, name, and role (doctor or receptionist).");
    }
    let doctorName = typeof account.doctorName === "string" ? account.doctorName.trim() : undefined;
    if (role === "doctor") {
      if (!doctorName) throw new Error("Each doctor account needs doctorName matching a clinic doctor.");
      const directoryMatch = CLINIC_DOCTORS.find(doctor => normalizeDoctor(doctor.name) === normalizeDoctor(doctorName));
      if (directoryMatch) doctorName = directoryMatch.name;
    }
    return { email: account.email.trim().toLowerCase(), password: account.password, name: account.name.trim(), role, doctorName };
  });
}

export function listClinicDoctors() {
  const accounts = loadClinicAccounts().filter(account => account.role === "doctor");
  return CLINIC_DOCTORS.map(doctor => {
    const account = accounts.find(item => normalizeDoctor(item.doctorName) === normalizeDoctor(doctor.name));
    return { ...doctor, email: account?.email || "" };
  });
}

function sessionSecret() {
  const secret = process.env.CLINIC_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Set CLINIC_SESSION_SECRET to a random value of at least 32 characters.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(account: ClinicAccount) {
  const session: ClinicSession = {
    email: account.email,
    role: account.role,
    name: account.name,
    ...(account.doctorName ? { doctorName: account.doctorName } : {}),
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token?: string): ClinicSession | null {
  if (!token) return null;
  try {
    const [payload, providedSignature] = token.split(".");
    if (!payload || !providedSignature) return null;
    const expectedSignature = signature(payload);
    const expected = Buffer.from(expectedSignature);
    const provided = Buffer.from(providedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ClinicSession;
    if (!session.email || !["doctor", "receptionist"].includes(session.role) || !session.expiresAt || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function readClinicSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  return verifySessionToken(cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : undefined);
}

export const clinicSessionMaxAge = SESSION_SECONDS;
