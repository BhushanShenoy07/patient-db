import { createHmac, timingSafeEqual } from "node:crypto";

export type ClinicRole = "doctor" | "receptionist";

export type ClinicProfile = {
  email: string;
  role: ClinicRole;
  name: string;
  doctorName?: string;
  specialization?: string;
  artUsername: string;
  firstName: string;
  lastName: string;
};

export type ClinicSession = ClinicProfile & { expiresAt: number };
export type ClinicAccount = ClinicProfile & { password: string };

export class ClinicConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicConfigurationError";
  }
}

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

export const doctorKey = (name?: string) => (name || "").trim().toLowerCase().replace(/^dr\.?\s*/, "");
export const sameDoctor = (a?: string, b?: string) => !!doctorKey(a) && doctorKey(a) === doctorKey(b);
const normalizeDoctor = (name?: string) => doctorKey(name);

export const SESSION_COOKIE = "clinic_session";
const SESSION_SECONDS = 8 * 60 * 60;
const ART_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function artUsernameFor(email: string) {
  let username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^[^a-z0-9]+/, "").slice(0, 32);
  if (!username || username.length < 3) {
    username = (username + "---").slice(0, 3).replace(/-+$/, "user");
  }
  return username;
}

export function splitName(name: string, role: ClinicRole) {
  const [firstName, ...rest] = name.replace(/^dr\.?\s*/i, "").split(/\s+/);
  return {
    firstName: firstName || (role === "doctor" ? "Doctor" : "Staff"),
    lastName: rest.join(" ") || (role === "doctor" ? "Physician" : "Receptionist"),
  };
}

const RAW_DEFAULT_ACCOUNTS: Array<{ email: string; password: string; name: string; role: ClinicRole; doctorName?: string; specialization?: string }> = [
  { email: "reception@clinic.com", password: "reception123", name: "Front Desk Staff", role: "receptionist" },
  { email: "doctor@clinic.com", password: "doctor123", name: "Dr. Ananya Rao", role: "doctor", doctorName: "Dr. Ananya Rao", specialization: "General Medicine" },
  { email: "arjun@clinic.com", password: "doctor123", name: "Dr. Arjun Mehta", role: "doctor", doctorName: "Dr. Arjun Mehta", specialization: "Cardiology" },
  { email: "neha@clinic.com", password: "doctor123", name: "Dr. Neha Sharma", role: "doctor", doctorName: "Dr. Neha Sharma", specialization: "Dermatology" },
  { email: "rohan@clinic.com", password: "doctor123", name: "Dr. Rohan Nair", role: "doctor", doctorName: "Dr. Rohan Nair", specialization: "Orthopedics" },
  { email: "priya@clinic.com", password: "doctor123", name: "Dr. Priya Menon", role: "doctor", doctorName: "Dr. Priya Menon", specialization: "Pediatrics" },
  { email: "karan@clinic.com", password: "doctor123", name: "Dr. Karan Iyer", role: "doctor", doctorName: "Dr. Karan Iyer", specialization: "Neurology" },
  { email: "sneha@clinic.com", password: "doctor123", name: "Dr. Sneha Kapoor", role: "doctor", doctorName: "Dr. Sneha Kapoor", specialization: "Gynecology" },
  { email: "vikram@clinic.com", password: "doctor123", name: "Dr. Vikram Shetty", role: "doctor", doctorName: "Dr. Vikram Shetty", specialization: "Ophthalmology" },
  { email: "aisha@clinic.com", password: "doctor123", name: "Dr. Aisha Khan", role: "doctor", doctorName: "Dr. Aisha Khan", specialization: "ENT" },
  { email: "rahul@clinic.com", password: "doctor123", name: "Dr. Rahul Desai", role: "doctor", doctorName: "Dr. Rahul Desai", specialization: "Gastroenterology" },
  { email: "bhushan@clinic.com", password: "doctor123", name: "Dr. Bhushan Shenoy", role: "doctor", doctorName: "Dr. Bhushan Shenoy", specialization: "Clinic Doctor" },
];

function buildClinicAccount(raw: { email: string; password: string; name: string; role: ClinicRole; doctorName?: string; specialization?: string }): ClinicAccount {
  const email = raw.email.trim().toLowerCase();
  const name = raw.name.trim();
  const role = raw.role;
  let doctorName = raw.doctorName?.trim();
  if (role === "doctor" && !doctorName) {
    const match = CLINIC_DOCTORS.find(d => normalizeDoctor(d.name) === normalizeDoctor(name));
    doctorName = match ? match.name : name;
  }
  const spec = raw.specialization?.trim() || (role === "doctor" ? (CLINIC_DOCTORS.find(d => normalizeDoctor(d.name) === normalizeDoctor(doctorName || name))?.specialization || "General Medicine") : undefined);
  const { firstName, lastName } = splitName(name, role);
  return {
    email,
    password: raw.password,
    name,
    role,
    doctorName,
    specialization: spec,
    artUsername: artUsernameFor(email),
    firstName,
    lastName,
  };
}

export const DEFAULT_CLINIC_ACCOUNTS: ClinicAccount[] = RAW_DEFAULT_ACCOUNTS.map(buildClinicAccount);

export function loadClinicAccounts(): ClinicAccount[] {
  const raw = process.env.CLINIC_USERS_JSON?.trim();
  if (!raw || raw === "xxx") {
    if (process.env.NODE_ENV === "production") {
      throw new ClinicConfigurationError("Clinic login is not configured. Add CLINIC_USERS_JSON in Vercel → Project Settings → Environment Variables, then redeploy.");
    }
    return DEFAULT_CLINIC_ACCOUNTS;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ClinicConfigurationError("Clinic login is misconfigured. CLINIC_USERS_JSON must contain a valid JSON array of staff accounts.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ClinicConfigurationError("Clinic login is misconfigured. CLINIC_USERS_JSON must contain a non-empty JSON array of staff accounts.");
  }

  const accounts: ClinicAccount[] = [];
  for (const account of parsed) {
    if (
      !account ||
      typeof account !== "object" ||
      !("email" in account) ||
      typeof account.email !== "string" ||
      !account.email.trim() ||
      !("password" in account) ||
      typeof account.password !== "string" ||
      !account.password ||
      !("role" in account) ||
      (account.role !== "doctor" && account.role !== "receptionist") ||
      !("name" in account) ||
      typeof account.name !== "string" ||
      !account.name.trim()
    ) {
      throw new ClinicConfigurationError("Clinic login is misconfigured. Each CLINIC_USERS_JSON account needs a non-empty email, password, name, and a role of doctor or receptionist.");
    }
    accounts.push(buildClinicAccount({
      email: account.email,
      password: account.password,
      name: account.name,
      role: account.role,
      doctorName: "doctorName" in account && typeof account.doctorName === "string" ? account.doctorName : undefined,
      specialization: "specialization" in account && typeof account.specialization === "string" ? account.specialization : undefined,
    }));
  }
  return accounts;
}

export function findClinicProfile(email: string): ClinicProfile | null {
  const account = loadClinicAccounts().find(item => item.email === email.trim().toLowerCase());
  if (!account) return null;
  const { password: _p, ...profile } = account;
  return profile;
}

export function listDoctorProfiles(): ClinicProfile[] {
  return loadClinicAccounts()
    .filter(account => account.role === "doctor")
    .map(({ password: _p, ...profile }) => profile);
}

export function findDoctorProfile(doctorName: string) {
  return listDoctorProfiles().find(doctor => sameDoctor(doctor.name, doctorName)) || null;
}

export function listClinicDoctors() {
  const accounts = loadClinicAccounts().filter(account => account.role === "doctor");
  return CLINIC_DOCTORS.map(doctor => {
    const account = accounts.find(item => normalizeDoctor(item.doctorName) === normalizeDoctor(doctor.name));
    const fallbackEmail = `${doctor.name.toLowerCase().replace(/[^a-z]/g, "")}@clinic.com`;
    const email = account?.email || fallbackEmail;
    return {
      name: doctor.name,
      specialization: doctor.specialization,
      email,
      artUsername: account?.artUsername || artUsernameFor(email),
    };
  });
}

/** Everyone a signed-in user can message: every other account in the clinic, without credentials. */
export function listClinicDirectory(self?: { email?: string }) {
  const selfEmail = self?.email?.trim().toLowerCase();
  return loadClinicAccounts()
    .filter(account => !selfEmail || account.email !== selfEmail)
    .map(({ name, role, specialization, artUsername }) => ({
      name,
      role,
      specialization: specialization || (role === "doctor" ? "General Medicine" : undefined),
      artUsername,
    }));
}

/** What the browser is allowed to see about the signed-in user. */
export function publicUser(profile: ClinicProfile) {
  return {
    email: profile.email,
    name: profile.name,
    role: profile.role,
    doctorName: profile.doctorName,
    specialization: profile.specialization,
    artUsername: profile.artUsername,
  };
}

function sessionSecret() {
  const secret = process.env.CLINIC_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === "xxx") {
    return "clinic-desk-super-secure-production-fallback-session-secret-key-32-chars";
  }
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(account: ClinicAccount | ClinicProfile) {
  const session: ClinicSession = {
    email: account.email,
    role: account.role,
    name: account.name,
    doctorName: account.doctorName,
    specialization: account.specialization,
    artUsername: account.artUsername,
    firstName: account.firstName,
    lastName: account.lastName,
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
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as any;
    if (!session.email || !["doctor", "receptionist"].includes(session.role) || !session.expiresAt || session.expiresAt <= Date.now()) return null;

    // Complement with fresh profile fields if missing from an older token
    const profile = findClinicProfile(session.email);
    if (!session.artUsername || !session.firstName) {
      if (profile) {
        return {
          ...profile,
          expiresAt: session.expiresAt,
        };
      }
      const { firstName, lastName } = splitName(session.name || "User", session.role);
      return {
        email: session.email,
        role: session.role,
        name: session.name,
        doctorName: session.doctorName,
        specialization: session.specialization,
        artUsername: artUsernameFor(session.email),
        firstName,
        lastName,
        expiresAt: session.expiresAt,
      };
    }

    return session as ClinicSession;
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
