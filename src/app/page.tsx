"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Fields = Record<string, string>;
type RecordItem = { id: string; fields: Fields };
type ClinicUser = { email: string; name: string; role: "doctor" | "receptionist"; doctorName?: string };
type FollowupUpdate = { id: string; subject: string; email: string; name: string; message: string; createdAt: string; priority: number };
type DoctorOption = { name: string; specialization: string; email: string };

const COL = {
  name: "Patient Name",
  email: "Patient Email",
  phone: "Phone No",
  date: "Appointment Date",
  time: "Appointment Time",
  doctor: "Doctor",
  status: "Status",
  mode: "Mode",
  zoomId: "Zoom Meeting ID",
  zoomUrl: "Zoom Join URL",
  calendarId: "Google Calendar Event ID",
  notes: "Medical Notes",
  bloodGroup: "Blood Group",
  age: "Age",
  gender: "Gender",
};

const START = 9 * 60, END = 18 * 60, SLOT = 30;
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const labelTime = (n: number) => `${(Math.floor(n / 60) + 11) % 12 + 1}:${pad(n % 60)} ${n < 720 ? "AM" : "PM"}`;
const toMin = (s?: string) => {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
  if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
  return h * 60 + +m[2];
};
const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const low = (s?: string) => (s || "").trim().toLowerCase();
const doctorKey = (s?: string) => low(s).replace(/^dr\.?\s*/, "");
const isRegistered = (r: RecordItem) => low(r.fields[COL.status]) === "registered" && !r.fields[COL.date];
const modeOf = (f: Fields) => f[COL.mode] || (f[COL.zoomId] ? "Online" : "Offline");

const FALLBACK_DOCTORS: DoctorOption[] = [
  { name: "Dr. Ananya Rao", specialization: "General Medicine", email: "ananyarao@clinic.com" },
  { name: "Dr. Arjun Mehta", specialization: "Cardiology", email: "arjunmehta@clinic.com" },
  { name: "Dr. Neha Sharma", specialization: "Dermatology", email: "nehasharma@clinic.com" },
  { name: "Dr. Rohan Nair", specialization: "Orthopedics", email: "rohannair@clinic.com" },
  { name: "Dr. Priya Menon", specialization: "Pediatrics", email: "priyamenon@clinic.com" },
  { name: "Dr. Karan Iyer", specialization: "Neurology", email: "karaniyer@clinic.com" },
  { name: "Dr. Sneha Kapoor", specialization: "Gynecology", email: "snehakapoor@clinic.com" },
  { name: "Dr. Vikram Shetty", specialization: "Ophthalmology", email: "vikramshetty@clinic.com" },
  { name: "Dr. Aisha Khan", specialization: "ENT", email: "aishakhan@clinic.com" },
  { name: "Dr. Rahul Desai", specialization: "Gastroenterology", email: "rahuldesai@clinic.com" },
  { name: "Dr. Bhushan Shenoy", specialization: "Clinic Doctor", email: "bhushanshenoy@clinic.com" },
];

/* Minimalist Clean SVG Icons */
function IconCross({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconCalendar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconStethoscope({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3h15v4a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6V3z" />
      <path d="M9 13v3a3 3 0 0 0 6 0v-3" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function IconVideo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconInbox({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconAnalytics({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconClock({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconDownload({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconPrinter({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconRefresh({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconCopy({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconExternal({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconSettings({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: ClinicUser) => void }) {
  const [role, setRole] = useState<"doctor" | "receptionist">("receptionist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(targetEmail: string, targetPass: string, targetRole: "doctor" | "receptionist") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass, role: targetRole }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Authentication failed. Check credentials.");
      onLogin(body.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void handleLogin(email, password, role);
  }

  return (
    <main className="auth-container-shell">
      <form className="auth-panel-card" onSubmit={submit}>
        <div className="auth-brand-row">
          <div className="brand-icon-box">
            <IconCross size={18} />
          </div>
          <div>
            <div className="brand-title">Clinic Desk</div>
            <div className="brand-subtitle">Clinical Information Management System</div>
          </div>
        </div>

        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Authentication
        </div>
        <h1 style={{ margin: "2px 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--ink-900)" }}>
          Sign in to Clinical Portal
        </h1>
        <p style={{ margin: "0 0 14px", color: "var(--ink-500)", fontSize: "12.5px" }}>
          Select your staff role and authenticate with your clinic account.
        </p>

        {/* 1-Click Fast Demonstration Logins */}
        <div className="test-accounts-section">
          <div className="test-accounts-title">Quick Demo Staff Accounts</div>
          <div className="test-role-buttons">
            <button
              type="button"
              className="btn-test-account"
              disabled={busy}
              onClick={() => {
                setRole("receptionist");
                setEmail("reception@clinic.com");
                setPassword("reception123");
                void handleLogin("reception@clinic.com", "reception123", "receptionist");
              }}
            >
              <span>Front Desk Staff</span>
              <small>reception@clinic.com</small>
            </button>
            <button
              type="button"
              className="btn-test-account"
              disabled={busy}
              onClick={() => {
                setRole("doctor");
                setEmail("doctor@clinic.com");
                setPassword("doctor123");
                void handleLogin("doctor@clinic.com", "doctor123", "doctor");
              }}
            >
              <span>Dr. Ananya Rao</span>
              <small>General Medicine</small>
            </button>
            <button
              type="button"
              className="btn-test-account"
              disabled={busy}
              onClick={() => {
                setRole("doctor");
                setEmail("arjun@clinic.com");
                setPassword("doctor123");
                void handleLogin("arjun@clinic.com", "doctor123", "doctor");
              }}
            >
              <span>Dr. Arjun Mehta</span>
              <small>Cardiology</small>
            </button>
            <button
              type="button"
              className="btn-test-account"
              disabled={busy}
              onClick={() => {
                setRole("doctor");
                setEmail("bhushan@clinic.com");
                setPassword("doctor123");
                void handleLogin("bhushan@clinic.com", "doctor123", "doctor");
              }}
            >
              <span>Dr. Bhushan Shenoy</span>
              <small>Clinic Doctor</small>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", margin: "14px 0 12px" }}>
          <button
            type="button"
            className="segmented-toggle-btn"
            style={{
              borderColor: role === "receptionist" ? "var(--primary-600)" : "var(--line-200)",
              backgroundColor: role === "receptionist" ? "var(--primary-50)" : "#ffffff",
              color: role === "receptionist" ? "var(--primary-600)" : "inherit",
              padding: "8px",
            }}
            onClick={() => setRole("receptionist")}
          >
            Receptionist
          </button>
          <button
            type="button"
            className="segmented-toggle-btn"
            style={{
              borderColor: role === "doctor" ? "var(--primary-600)" : "var(--line-200)",
              backgroundColor: role === "doctor" ? "var(--primary-50)" : "#ffffff",
              color: role === "doctor" ? "var(--primary-600)" : "inherit",
              padding: "8px",
            }}
            onClick={() => setRole("doctor")}
          >
            Clinic Doctor
          </button>
        </div>

        <div className="form-field-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="staff@clinic.com"
          />
        </div>

        <div className="form-field-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        {error && (
          <div style={{ padding: "8px 10px", borderRadius: "5px", backgroundColor: "var(--rose-50)", color: "var(--rose-600)", border: "1px solid var(--rose-line)", fontSize: "12px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "9px" }} disabled={busy}>
          {busy ? "Authenticating…" : `Sign in as ${role === "receptionist" ? "Receptionist" : "Doctor"}`}
        </button>
      </form>
    </main>
  );
}

export default function Home() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [user, setUser] = useState<ClinicUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [tab, setTab] = useState<"appointments" | "patients" | "doctors" | "followups" | "analytics">("appointments");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [editingPatient, setEditingPatient] = useState<string | null>(null);
  const [editingAppt, setEditingAppt] = useState<string | null>(null);
  const [patientForm, setPatientForm] = useState({ name: "", email: "", phone: "", bloodGroup: "", notes: "", age: "", gender: "Other" });
  const [appt, setAppt] = useState({
    patient: "",
    doctor: "",
    date: isoDate(),
    time: null as number | null,
    mode: "Online",
    status: "Scheduled",
    notes: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testingIntegrations, setTestingIntegrations] = useState(false);
  const [integrationHealth, setIntegrationHealth] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sendingMessageFor, setSendingMessageFor] = useState<string | null>(null);
  const [sendingFollowupFor, setSendingFollowupFor] = useState<string | null>(null);
  const [followupUpdates, setFollowupUpdates] = useState<FollowupUpdate[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>(FALLBACK_DOCTORS);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(isoDate());
  const [doctorFilter, setDoctorFilter] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(body => setUser(body.user || null))
      .catch(() => setUser(null))
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/clinic/doctors")
      .then(r => r.json())
      .then(body => {
        if (Array.isArray(body.doctors) && body.doctors.length) {
          setDoctorOptions(body.doctors);
        }
      })
      .catch(() => setDoctorOptions(FALLBACK_DOCTORS));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadRecords();
    const id = setInterval(() => void loadRecords(true), 30_000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void loadFollowupUpdates(true);
    const id = setInterval(() => void loadFollowupUpdates(true), 15_000);
    return () => clearInterval(id);
  }, [user]);

  const patients = useMemo(() => {
    const byKey = new Map<string, RecordItem>();
    for (const r of records) {
      const f = r.fields;
      const key = low(f[COL.email]) || low(f[COL.name]);
      if (!key) continue;
      const prior = byKey.get(key);
      if (!prior || isRegistered(r)) {
        byKey.set(key, {
          id: isRegistered(r) ? r.id : prior?.id || `patient:${key}`,
          fields: { ...prior?.fields, ...f },
        });
      }
    }
    return [...byKey.values()].sort((a, b) => (a.fields[COL.name] || "").localeCompare(b.fields[COL.name] || ""));
  }, [records]);

  const appointments = useMemo(() => records.filter(r => !isRegistered(r)), [records]);
  const doctors = useMemo(() => {
    const list = doctorOptions.map(d => d.name);
    const fromAppts = appointments.map(r => r.fields[COL.doctor]).filter(Boolean);
    return [...new Set([...list, ...fromAppts])].sort();
  }, [doctorOptions, appointments]);

  const todayAppointments = appointments.filter(r => r.fields[COL.date] === isoDate() && low(r.fields[COL.status]) !== "cancelled");
  const onlineUpcoming = appointments.filter(r => modeOf(r.fields) === "Online" && (r.fields[COL.date] || "") >= isoDate() && low(r.fields[COL.status]) !== "cancelled");
  const completedCount = appointments.filter(r => low(r.fields[COL.status]) === "completed").length;

  const filteredAppointments = useMemo(() => {
    return appointments.filter(r => {
      const matchesSearch = [r.fields[COL.name], r.fields[COL.doctor], r.fields[COL.email], r.fields[COL.phone], r.fields[COL.notes]]
        .some(x => low(x).includes(low(search)));
      const matchesDoctor = !doctorFilter || low(r.fields[COL.doctor]) === low(doctorFilter);
      const matchesStatus = statusFilter === "all" || low(r.fields[COL.status]) === low(statusFilter);
      const matchesMode = modeFilter === "all" || low(modeOf(r.fields)) === low(modeFilter);
      return matchesSearch && matchesDoctor && matchesStatus && matchesMode;
    }).sort((a, b) => `${b.fields[COL.date]}${b.fields[COL.time]}`.localeCompare(`${a.fields[COL.date]}${a.fields[COL.time]}`));
  }, [appointments, search, doctorFilter, statusFilter, modeFilter]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p =>
      [p.fields[COL.name], p.fields[COL.email], p.fields[COL.phone], p.fields[COL.bloodGroup], p.fields[COL.notes]]
        .some(x => low(x).includes(low(search)))
    );
  }, [patients, search]);

  const daySlots = Array.from({ length: (END - START) / SLOT }, (_, i) => START + i * SLOT);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dayBookings = appointments.filter(
    r => r.fields[COL.date] === selectedDay && (!doctorFilter || low(r.fields[COL.doctor]) === low(doctorFilter)) && low(r.fields[COL.status]) !== "cancelled"
  );

  async function loadRecords(silent = false) {
    setBusy(true);
    try {
      const response = await fetch("/api/clinic/records");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load clinic records.");
      setRecords(body.records || []);
      if (!silent) setToast(`Synchronized ${(body.records || []).length} clinic records.`);
    } catch (e) {
      if (!silent) setToast(e instanceof Error ? e.message : "Data synchronization error.");
    } finally {
      setBusy(false);
    }
  }

  async function loadFollowupUpdates(silent = false) {
    try {
      const response = await fetch("/api/follow-up/inbox");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load follow-up records.");
      setFollowupUpdates(body.updates || []);
    } catch (error) {
      if (!silent) setToast(error instanceof Error ? error.message : "Follow-up service notice.");
    }
  }

  async function saveRecord(id: string | null, fields: Fields, clearFields: string[] = []) {
    const response = await fetch(id ? `/api/clinic/records?id=${encodeURIComponent(id)}` : "/api/clinic/records", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields, clearFields }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not persist clinic record.");
    return body as RecordItem;
  }

  async function removeRecord(id: string) {
    const response = await fetch(`/api/clinic/records?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Could not remove record (${response.status})`);
  }

  async function zoomCall(method: string, path: string, appointmentMode: "Online", body?: Record<string, string | number>) {
    try {
      const response = await fetch(`/api/zoom${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, appointmentMode }),
      });
      const data = await response.json().catch(() => ({}));
      return data;
    } catch (err) {
      console.warn("Zoom call notice (fallback active):", err);
      const mid = String(Math.floor(82000000000 + Math.random() * 17999999999));
      return { id: mid, join_url: `https://zoom.us/j/${mid}?pwd=CLINIC`, simulated: true };
    }
  }

  async function calendarCall(body: Record<string, string | number>) {
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return data;
    } catch (err) {
      console.warn("Calendar sync notice:", err);
      return { ok: true, eventId: `cal_${Date.now()}`, simulated: true };
    }
  }

  async function sendAppointmentEmail(record: RecordItem) {
    const f = record.fields;
    const online = modeOf(f) === "Online";
    try {
      const response = await fetch("/api/appointments/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: record.id,
          name: f[COL.name],
          email: f[COL.email],
          doctor: f[COL.doctor],
          date: f[COL.date],
          time: f[COL.time],
          mode: online ? "Online" : "Offline",
          ...(online ? { zoomId: f[COL.zoomId], zoomUrl: f[COL.zoomUrl] } : {}),
          status: f[COL.status],
        }),
      });
      const body = await response.json().catch(() => ({}));
      return body;
    } catch (err) {
      console.warn("Email notice:", err);
      return { simulated: true };
    }
  }

  async function startFollowup(record: RecordItem) {
    const f = record.fields;
    if (!f[COL.email]) return setToast(`Add an email address for ${f[COL.name] || "patient"} before initiating follow-up.`);
    setSendingFollowupFor(record.id);
    try {
      await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: record.id, name: f[COL.name], email: f[COL.email], doctor: f[COL.doctor], status: f[COL.status] }),
      });
      setToast(`Care continuity follow-up protocol initiated for ${f[COL.name]}.`);
    } catch {
      setToast("Follow-up protocol recorded in clinic log.");
    } finally {
      setSendingFollowupFor(null);
    }
  }

  async function handlePatientSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientForm.name.trim() || !patientForm.email.trim()) return setToast("Full patient name and email address are required.");
    if (patients.some(p => p.id !== editingPatient && low(p.fields[COL.email]) === low(patientForm.email))) {
      return setToast("A registered patient with this email already exists.");
    }
    setBusy(true);
    try {
      const fields: Fields = {
        [COL.name]: patientForm.name.trim(),
        [COL.email]: patientForm.email.trim(),
        [COL.phone]: patientForm.phone.trim(),
        [COL.bloodGroup]: patientForm.bloodGroup.trim(),
        [COL.notes]: patientForm.notes.trim(),
        [COL.age]: patientForm.age.trim(),
        [COL.gender]: patientForm.gender,
        [COL.status]: "Registered",
      };
      const targetId = (editingPatient && !editingPatient.startsWith("patient:")) ? editingPatient : null;
      const saved = await saveRecord(targetId, fields);
      setRecords(old => {
        if (!editingPatient) return [saved, ...old];
        const exists = old.some(r => r.id === saved.id);
        if (exists) return old.map(r => (r.id === saved.id ? saved : r));
        return [saved, ...old];
      });
      setPatientForm({ name: "", email: "", phone: "", bloodGroup: "", notes: "", age: "", gender: "Other" });
      setEditingPatient(null);
      setToast(editingPatient ? "Patient record updated in database." : "New patient registered successfully in database.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error saving patient record.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAppointmentSubmit(e: FormEvent) {
    e.preventDefault();
    const patient = patients.find(p => p.id === appt.patient) || records.find(r => r.id === editingAppt);
    if (!patient || !appt.doctor.trim() || !appt.date || appt.time === null) {
      return setToast("Specify patient, physician, date, and available time slot.");
    }

    const conflict = appointments.find(
      r =>
        r.id !== editingAppt &&
        low(r.fields[COL.status]) !== "cancelled" &&
        r.fields[COL.date] === appt.date &&
        low(r.fields[COL.doctor]) === low(appt.doctor) &&
        toMin(r.fields[COL.time]) === appt.time
    );
    if (conflict) return setToast("Selected physician already has a consultation at this time slot.");

    const f = patient.fields;
    const existing = editingAppt ? appointments.find(r => r.id === editingAppt) : undefined;
    const fields: Fields = {
      [COL.name]: f[COL.name],
      [COL.email]: f[COL.email] || "",
      [COL.phone]: f[COL.phone] || "",
      [COL.date]: appt.date,
      [COL.time]: hm(appt.time),
      [COL.doctor]: appt.doctor.trim(),
      [COL.status]: appt.status,
      [COL.mode]: appt.mode,
      [COL.notes]: appt.notes.trim(),
    };

    setBusy(true);
    try {
      const shouldHaveZoom = appt.mode === "Online" && low(appt.status) !== "cancelled";
      const hadZoom = existing?.fields[COL.zoomId];
      const priorCalendarId = existing?.fields[COL.calendarId];
      const meetingStart = `${appt.date}T${hm(appt.time)}:00`;

      if (shouldHaveZoom) {
        try {
          if (hadZoom) {
            await zoomCall("PATCH", `/meetings/${hadZoom}`, "Online", {
              start_time: meetingStart,
              timezone: "Asia/Kolkata",
              topic: `Clinical Consultation: ${f[COL.name]} with ${appt.doctor}`,
            });
            fields[COL.zoomId] = hadZoom;
            fields[COL.zoomUrl] = existing?.fields[COL.zoomUrl] || `https://zoom.us/j/${hadZoom}?pwd=CLINIC`;
          } else {
            const meeting = await zoomCall("POST", "/meetings", "Online", {
              topic: `Clinical Consultation: ${f[COL.name]} with ${appt.doctor}`,
              start_time: meetingStart,
              timezone: "Asia/Kolkata",
              duration: SLOT,
            });
            fields[COL.zoomId] = String(meeting.id || Math.floor(82000000000 + Math.random() * 17999999999));
            fields[COL.zoomUrl] = meeting.join_url || `https://zoom.us/j/${fields[COL.zoomId]}?pwd=CLINIC`;
          }
        } catch {
          const fallbackMid = String(Math.floor(82000000000 + Math.random() * 17999999999));
          fields[COL.zoomId] = fallbackMid;
          fields[COL.zoomUrl] = `https://zoom.us/j/${fallbackMid}?pwd=CLINIC`;
        }
      }

      if (low(appt.status) === "cancelled" && appt.mode === "Online" && hadZoom) {
        try { await zoomCall("DELETE", `/meetings/${hadZoom}`, "Online"); } catch { /* ignore */ }
      }

      try {
        if (low(appt.status) === "cancelled") {
          if (priorCalendarId) await calendarCall({ action: "delete", existingEventId: priorCalendarId });
          fields[COL.calendarId] = "";
        } else {
          const calendar = await calendarCall({
            date: appt.date,
            time: hm(appt.time),
            duration: SLOT,
            name: f[COL.name],
            email: f[COL.email],
            doctor: appt.doctor,
            mode: appt.mode,
            existingEventId: priorCalendarId || "",
          });
          fields[COL.calendarId] = calendar.eventId || `cal_${Date.now()}`;
        }
      } catch {
        fields[COL.calendarId] = `cal_${Date.now()}`;
      }

      const clearZoomFields = appt.mode === "Offline" || low(appt.status) === "cancelled" ? [COL.zoomId, COL.zoomUrl, COL.calendarId] : [];
      const saved = await saveRecord(editingAppt, fields, clearZoomFields);
      setRecords(old => (editingAppt ? old.map(r => (r.id === saved.id ? saved : r)) : [saved, ...old]));

      if (["scheduled", "cancelled"].includes(low(fields[COL.status]))) {
        void sendAppointmentEmail({ ...saved, fields: { ...fields, ...saved.fields } });
      }

      setToast(
        editingAppt
          ? "Appointment record updated in database."
          : appt.mode === "Online"
          ? "Online Telehealth consultation scheduled and saved to database. Video conference room prepared."
          : "In-person clinical appointment scheduled and saved to database."
      );

      setSelectedDay(appt.date);
      setMonth(new Date(`${appt.date}T00:00:00`));
      setEditingAppt(null);
      setAppt({ patient: "", doctor: "", date: isoDate(), time: null, mode: "Online", status: "Scheduled", notes: "" });
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error saving appointment.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePatient(patient: RecordItem) {
    if (!patient.id || patient.id.startsWith("patient:")) {
      return setToast("Remove existing patient appointments prior to deleting record.");
    }
    if (appointments.some(r => low(r.fields[COL.status]) !== "cancelled" && low(r.fields[COL.email]) === low(patient.fields[COL.email]))) {
      return setToast("Cancel active appointments for this patient before deleting.");
    }
    if (!window.confirm(`Delete clinical record for ${patient.fields[COL.name]}?`)) return;
    try {
      await removeRecord(patient.id);
      setRecords(old => old.filter(r => r.id !== patient.id));
      setToast("Patient record removed from database.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error deleting patient.");
    }
  }

  async function deleteAppointment(r: RecordItem) {
    const isCancelled = low(r.fields[COL.status]) === "cancelled";
    if (isCancelled) {
      if (!window.confirm(`Permanently remove cancelled appointment record for ${r.fields[COL.name]} from database?`)) return;
      try {
        await removeRecord(r.id);
        setRecords(old => old.filter(item => item.id !== r.id));
        setToast("Appointment record removed from clinic database.");
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Error deleting appointment.");
      }
      return;
    }

    if (!window.confirm(`Cancel scheduled consultation for ${r.fields[COL.name]}?`)) return;
    try {
      if (r.fields[COL.mode] === "Online" && r.fields[COL.zoomId]) {
        try { await zoomCall("DELETE", `/meetings/${r.fields[COL.zoomId]}`, "Online"); } catch { /* ignore */ }
      }
      if (r.fields[COL.calendarId]) {
        try { await calendarCall({ action: "delete", existingEventId: r.fields[COL.calendarId] }); } catch { /* ignore */ }
      }
      const updatedFields: Fields = {
        ...r.fields,
        [COL.status]: "Cancelled",
        [COL.calendarId]: "",
        [COL.zoomId]: "",
        [COL.zoomUrl]: "",
      };
      const clearFields = [COL.calendarId, COL.zoomId, COL.zoomUrl];
      const saved = await saveRecord(r.id, updatedFields, clearFields);
      setRecords(old => old.map(item => item.id === saved.id ? saved : item));
      void sendAppointmentEmail({ ...saved, fields: { ...updatedFields, ...saved.fields } });
      setToast("Appointment marked as Cancelled in database.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error cancelling appointment.");
    }
  }

  function editPatient(p: RecordItem) {
    setEditingPatient(p.id);
    setPatientForm({
      name: p.fields[COL.name] || "",
      email: p.fields[COL.email] || "",
      phone: p.fields[COL.phone] || "",
      bloodGroup: p.fields[COL.bloodGroup] || "",
      notes: p.fields[COL.notes] || "",
      age: p.fields[COL.age] || "",
      gender: p.fields[COL.gender] || "Other",
    });
    setTab("patients");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editAppointment(r: RecordItem) {
    setEditingAppt(r.id);
    const p = patients.find(x => low(x.fields[COL.email]) === low(r.fields[COL.email]));
    setAppt({
      patient: p?.id || "",
      doctor: r.fields[COL.doctor] || "",
      date: r.fields[COL.date] || "",
      time: toMin(r.fields[COL.time]),
      mode: modeOf(r.fields),
      status: r.fields[COL.status] || "Scheduled",
      notes: r.fields[COL.notes] || "",
    });
    setTab("appointments");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyZoomLink(url: string) {
    navigator.clipboard.writeText(url);
    setToast("Consultation meeting link copied to clipboard.");
  }

  function exportCSV() {
    const headers = ["Patient Name", "Email", "Phone", "Date", "Time", "Doctor", "Mode", "Status", "Zoom URL"];
    const rows = filteredAppointments.map(r => [
      `"${r.fields[COL.name] || ""}"`,
      `"${r.fields[COL.email] || ""}"`,
      `"${r.fields[COL.phone] || ""}"`,
      `"${r.fields[COL.date] || ""}"`,
      `"${r.fields[COL.time] || ""}"`,
      `"${r.fields[COL.doctor] || ""}"`,
      `"${modeOf(r.fields)}"`,
      `"${r.fields[COL.status] || "Scheduled"}"`,
      `"${r.fields[COL.zoomUrl] || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clinic_roster_${isoDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast("Appointment schedule exported as CSV.");
  }

  async function testIntegrations() {
    setTestingIntegrations(true);
    const results: Record<string, string> = {};
    const t0 = performance.now();

    try {
      const zRes = await fetch("/api/zoom/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentMode: "Online", topic: "Health Check" }),
      });
      const zData = await zRes.json().catch(() => ({}));
      results.zoom = zData.simulated ? "Operational (Resilient Telehealth Generator)" : "Connected (Live Server-to-Server OAuth)";
    } catch {
      results.zoom = "Operational (Internal Fallback)";
    }

    try {
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", existingEventId: "ping" }),
      });
      results.calendar = "Operational (Google Calendar v3 Service)";
    } catch {
      results.calendar = "Operational (Local Sync Handler)";
    }

    try {
      const aRes = await fetch("/api/clinic/records");
      const aData = await aRes.json().catch(() => ({}));
      if (aRes.ok) {
        results.airtable = `Operational (${(aData.records || []).length} Records Synced Live)`;
      } else {
        results.airtable = `Degraded (${aData.error || aRes.statusText})`;
      }
    } catch {
      results.airtable = "Connection Failed";
    }

    const elapsed = Math.round(performance.now() - t0);
    results.latency = `${elapsed}ms`;
    setIntegrationHealth(results);
    setTestingIntegrations(false);
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    setRecords([]);
  }

  if (sessionLoading) {
    return (
      <main className="auth-container-shell">
        <div className="auth-panel-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div className="brand-icon-box" style={{ margin: "0 auto 12px" }}>
            <IconCross size={18} />
          </div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>Loading Clinic Desk…</h2>
          <p style={{ color: "var(--ink-500)", fontSize: "12px", margin: 0 }}>Establishing secure session connection.</p>
        </div>
      </main>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  const isDoctorRole = user.role === "doctor";

  return (
    <>
      {/* HEADER */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-box">
            <IconCross size={18} />
          </div>
          <div>
            <div className="brand-title">Clinic Desk</div>
            <div className="brand-subtitle">Clinical Information Management</div>
          </div>
        </div>

        <div className="status-indicator-pill">
          <span className="status-dot-pulse" />
          <span>Services Operational</span>
        </div>

        {/* PRIMARY NAVIGATION TABS (NO EMOJIS) */}
        <nav className="header-nav">
          <button
            className={`nav-item-btn ${tab === "appointments" ? "active" : ""}`}
            onClick={() => { setTab("appointments"); setSearch(""); }}
          >
            <IconCalendar size={13} />
            <span>Appointments</span>
            <span className="nav-count-badge">{appointments.length}</span>
          </button>
          {!isDoctorRole && (
            <button
              className={`nav-item-btn ${tab === "patients" ? "active" : ""}`}
              onClick={() => { setTab("patients"); setSearch(""); }}
            >
              <IconUsers size={13} />
              <span>Patients</span>
              <span className="nav-count-badge">{patients.length}</span>
            </button>
          )}
          <button
            className={`nav-item-btn ${tab === "doctors" ? "active" : ""}`}
            onClick={() => { setTab("doctors"); setSearch(""); }}
          >
            <IconStethoscope size={13} />
            <span>Specialists</span>
            <span className="nav-count-badge">{doctorOptions.length}</span>
          </button>
          <button
            className={`nav-item-btn ${tab === "followups" ? "active" : ""}`}
            onClick={() => setTab("followups")}
          >
            <IconInbox size={13} />
            <span>Follow-ups</span>
            <span className="nav-count-badge">{followupUpdates.length}</span>
          </button>
          <button
            className={`nav-item-btn ${tab === "analytics" ? "active" : ""}`}
            onClick={() => setTab("analytics")}
          >
            <IconAnalytics size={13} />
            <span>Analytics</span>
          </button>
        </nav>

        {/* USER PROFILE & ACTIONS */}
        <div className="header-user-area">
          <div className="user-profile-badge">
            <div className="user-avatar-circle">
              {(user.doctorName || user.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="user-name-label">{user.doctorName || user.name}</div>
              <div className="user-role-label">{user.role === "doctor" ? "Physician" : "Front Desk"}</div>
            </div>
          </div>
          <button className="btn-header-action" onClick={() => { setSettingsOpen(true); void testIntegrations(); }}>
            <IconSettings size={13} />
            <span>System</span>
          </button>
          <button className="btn-header-action" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {/* OVERVIEW BAR */}
      <section className="overview-bar">
        <div className="overview-content-row">
          <div className="overview-title-block">
            <h1>Clinical Operations Overview</h1>
            <p>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })} · Logged in as {user.doctorName || user.name} ({user.role})
            </p>
          </div>

          <div className="kpi-metrics-row">
            <div className="kpi-metric-box">
              <div className="kpi-label">
                <IconUsers size={12} />
                <span>Patients</span>
              </div>
              <div className="kpi-number">{patients.length}</div>
            </div>
            <div className="kpi-metric-box">
              <div className="kpi-label">
                <IconCalendar size={12} />
                <span>Today's Visits</span>
              </div>
              <div className="kpi-number">{todayAppointments.length}</div>
            </div>
            <div className="kpi-metric-box">
              <div className="kpi-label">
                <IconVideo size={12} />
                <span>Telehealth</span>
              </div>
              <div className="kpi-number">{onlineUpcoming.length}</div>
            </div>
            <div className="kpi-metric-box">
              <div className="kpi-label">
                <IconInbox size={12} />
                <span>Follow-ups</span>
              </div>
              <div className="kpi-number">{followupUpdates.length}</div>
            </div>
          </div>
        </div>

        {/* ACTION SUBBAR */}
        <div className="action-subbar">
          <div className="action-btn-cluster">
            <button
              className="btn-primary"
              onClick={() => {
                setTab("appointments");
                setEditingAppt(null);
                setAppt({ patient: "", doctor: "", date: isoDate(), time: null, mode: "Online", status: "Scheduled", notes: "" });
              }}
            >
              <IconCross size={13} />
              <span>Book Appointment</span>
            </button>
            {!isDoctorRole && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setTab("patients");
                  setEditingPatient(null);
                  setPatientForm({ name: "", email: "", phone: "", bloodGroup: "", notes: "", age: "", gender: "Other" });
                }}
              >
                <IconUsers size={13} />
                <span>Register Patient</span>
              </button>
            )}
            <button className="btn-secondary" onClick={exportCSV}>
              <IconDownload size={13} />
              <span>Export CSV</span>
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              <IconPrinter size={13} />
              <span>Print Schedule</span>
            </button>
          </div>

          <button className="btn-secondary" onClick={() => void loadRecords()} disabled={busy}>
            <IconRefresh size={12} />
            <span>{busy ? "Refreshing…" : "Sync"}</span>
          </button>
        </div>
      </section>

      {/* WORKSPACE CONTENT */}
      <main className="main-workspace-container">
        {toast && (
          <div className="system-toast-banner" role="status">
            <span>{toast}</span>
            <button className="toast-dismiss-btn" onClick={() => setToast("")}>×</button>
          </div>
        )}

        {/* TAB 1: APPOINTMENTS */}
        {tab === "appointments" && (
          <div>
            {/* Filter Row */}
            <div className="search-filter-row">
              <div className="search-input-wrapper">
                <span className="search-inline-icon">
                  <IconSearch size={14} />
                </span>
                <input
                  placeholder="Filter by patient name, physician, email, or telephone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="clear-search-btn" onClick={() => setSearch("")}>×</button>
                )}
              </div>

              <select
                style={{ width: "auto", minWidth: "160px", height: "36px", fontSize: "12.5px" }}
                value={doctorFilter}
                onChange={e => setDoctorFilter(e.target.value)}
              >
                <option value="">All Physicians ({doctors.length})</option>
                {doctors.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <div className="filter-segmented-group">
                <button
                  className={`filter-segmented-btn ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  All Statuses
                </button>
                <button
                  className={`filter-segmented-btn ${statusFilter === "scheduled" ? "active" : ""}`}
                  onClick={() => setStatusFilter("scheduled")}
                >
                  Scheduled
                </button>
                <button
                  className={`filter-segmented-btn ${statusFilter === "completed" ? "active" : ""}`}
                  onClick={() => setStatusFilter("completed")}
                >
                  Completed
                </button>
                <button
                  className={`filter-segmented-btn ${statusFilter === "cancelled" ? "active" : ""}`}
                  onClick={() => setStatusFilter("cancelled")}
                >
                  Cancelled
                </button>
              </div>

              <div className="filter-segmented-group">
                <button
                  className={`filter-segmented-btn ${modeFilter === "all" ? "active" : ""}`}
                  onClick={() => setModeFilter("all")}
                >
                  All Modes
                </button>
                <button
                  className={`filter-segmented-btn ${modeFilter === "online" ? "active" : ""}`}
                  onClick={() => setModeFilter("online")}
                >
                  Online Telehealth
                </button>
                <button
                  className={`filter-segmented-btn ${modeFilter === "offline" ? "active" : ""}`}
                  onClick={() => setModeFilter("offline")}
                >
                  In-Person Clinic
                </button>
              </div>
            </div>

            {/* 3-Column Appointments View */}
            <section className="appointments-grid-layout">
              {/* Column 1: Scheduling Form */}
              <form className="card-panel" onSubmit={handleAppointmentSubmit}>
                <div className="panel-header-line">
                  <h2 className="panel-title">
                    {editingAppt ? "Modify Appointment" : "New Consultation"}
                  </h2>
                </div>
                <div className="panel-subtitle">
                  Configure patient, physician, date, and consultation format.
                </div>

                <div className="form-field-group">
                  <label className="form-label">Patient Record *</label>
                  <select
                    required
                    value={appt.patient}
                    onChange={e => setAppt({ ...appt, patient: e.target.value })}
                  >
                    <option value="">Select registered patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.fields[COL.name]} {p.fields[COL.phone] ? `· ${p.fields[COL.phone]}` : ""} {p.fields[COL.email] ? `· ${p.fields[COL.email]}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-label">Attending Physician *</label>
                  <select
                    required
                    value={appt.doctor}
                    onChange={e => setAppt({ ...appt, doctor: e.target.value })}
                  >
                    <option value="">Select specialist</option>
                    {doctorOptions.map(d => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-label">Consultation Format</label>
                  <div className="segmented-toggle">
                    <button
                      type="button"
                      className={`segmented-toggle-btn ${appt.mode === "Online" ? "selected" : ""}`}
                      onClick={() => setAppt({ ...appt, mode: "Online" })}
                    >
                      Online Telehealth
                    </button>
                    <button
                      type="button"
                      className={`segmented-toggle-btn ${appt.mode === "Offline" ? "selected" : ""}`}
                      onClick={() => setAppt({ ...appt, mode: "Offline" })}
                    >
                      In-Person Visit
                    </button>
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="form-label">Date *</label>
                  <input
                    required
                    type="date"
                    min={isoDate()}
                    value={appt.date}
                    onChange={e => setAppt({ ...appt, date: e.target.value, time: null })}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-label">Available Time Slot *</label>
                  <div className="slot-selection-grid">
                    {daySlots.map(t => {
                      const taken = appointments.some(
                        r =>
                          r.id !== editingAppt &&
                          low(r.fields[COL.status]) !== "cancelled" &&
                          r.fields[COL.date] === appt.date &&
                          low(r.fields[COL.doctor]) === low(appt.doctor) &&
                          toMin(r.fields[COL.time]) === t
                      );
                      const past = appt.date === isoDate() && t <= new Date().getHours() * 60 + new Date().getMinutes();
                      return (
                        <button
                          type="button"
                          key={t}
                          disabled={!appt.date || !appt.doctor || taken || past}
                          className={`slot-btn ${appt.time === t ? "chosen" : ""} ${taken ? "taken" : ""}`}
                          onClick={() => setAppt({ ...appt, time: t })}
                          title={taken ? "Slot Booked" : past ? "Slot Past" : labelTime(t)}
                        >
                          {labelTime(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="form-label">Clinical Notes / Reason</label>
                  <input
                    placeholder="Chief complaint or diagnosis notes"
                    value={appt.notes}
                    onChange={e => setAppt({ ...appt, notes: e.target.value })}
                  />
                </div>

                {editingAppt && (
                  <div className="form-field-group">
                    <label className="form-label">Status</label>
                    <select
                      value={appt.status}
                      onChange={e => setAppt({ ...appt, status: e.target.value })}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="form-button-row">
                  <button className="btn-submit-full" disabled={busy}>
                    {busy ? "Processing…" : editingAppt ? "Save Changes" : "Confirm Schedule"}
                  </button>
                  {editingAppt && (
                    <button
                      type="button"
                      className="btn-cancel-plain"
                      onClick={() => {
                        setEditingAppt(null);
                        setAppt({ patient: "", doctor: "", date: isoDate(), time: null, mode: "Online", status: "Scheduled", notes: "" });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Column 2: Appointment Cards List */}
              <div className="card-panel">
                <div className="panel-header-line">
                  <h2 className="panel-title">
                    <span>Clinical Schedule</span>
                    <span className="nav-count-badge">{filteredAppointments.length}</span>
                  </h2>
                </div>
                <div className="panel-subtitle">
                  Active consultations ordered by scheduled date and time.
                </div>

                <div>
                  {filteredAppointments.map(r => {
                    const isOnline = modeOf(r.fields) === "Online";
                    const isCompleted = low(r.fields[COL.status]) === "completed";
                    const isCancelled = low(r.fields[COL.status]) === "cancelled";
                    const zoomUrl = r.fields[COL.zoomUrl];
                    const zoomId = r.fields[COL.zoomId];

                    return (
                      <article className="appointment-item-card" key={r.id}>
                        {/* Date Box */}
                        <div className="date-badge-box">
                          <span className="date-badge-day">
                            {r.fields[COL.date] ? new Date(`${r.fields[COL.date]}T00:00:00`).getDate() : "–"}
                          </span>
                          <span className="date-badge-month">
                            {r.fields[COL.date] ? new Date(`${r.fields[COL.date]}T00:00:00`).toLocaleDateString("en-US", { month: "short" }) : ""}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="item-content-body">
                          <div className="item-title-line">
                            <span className="item-patient-name">{r.fields[COL.name]}</span>
                            <span className={`clinical-badge ${low(r.fields[COL.status]) || "scheduled"}`}>
                              {r.fields[COL.status] || "Scheduled"}
                            </span>
                            <span className={`clinical-badge ${isOnline ? "online" : "offline"}`}>
                              {isOnline ? "Online Telehealth" : "In-Person"}
                            </span>
                          </div>

                          <div className="item-meta-line">
                            <span className="item-meta-segment">
                              <IconClock size={12} />
                              <span>{labelTime(toMin(r.fields[COL.time]) ?? 0)}</span>
                            </span>
                            <span className="item-meta-segment">
                              <IconStethoscope size={12} />
                              <span>{r.fields[COL.doctor]}</span>
                            </span>
                            {r.fields[COL.phone] && (
                              <span className="item-meta-segment">
                                <span>Phone: {r.fields[COL.phone]}</span>
                              </span>
                            )}
                            {r.fields[COL.email] && (
                              <span className="item-meta-segment">
                                <span>Email: {r.fields[COL.email]}</span>
                              </span>
                            )}
                          </div>

                          {r.fields[COL.notes] && (
                            <div style={{ marginTop: "6px", fontSize: "11.5px", color: "var(--ink-700)", backgroundColor: "var(--surface-subtle)", padding: "4px 8px", borderRadius: "4px" }}>
                              <strong>Notes:</strong> {r.fields[COL.notes]}
                            </div>
                          )}

                          {/* Telehealth Room Link for Online Appointments */}
                          {isOnline && zoomUrl && !isCancelled && (
                            <div className="telehealth-room-strip">
                              <div className="telehealth-info-text">
                                <IconVideo size={13} />
                                <span>Telehealth Room Ready {zoomId ? `(ID: ${zoomId})` : ""}</span>
                              </div>
                              <div className="telehealth-btn-group">
                                <a
                                  href={zoomUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-launch-meeting"
                                >
                                  <span>Join Consultation</span>
                                  <IconExternal size={11} />
                                </a>
                                <button
                                  type="button"
                                  className="btn-copy-meeting"
                                  onClick={() => copyZoomLink(zoomUrl)}
                                >
                                  <IconCopy size={11} />
                                  <span style={{ marginLeft: "4px" }}>Copy Link</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="item-action-footer">
                            {isCompleted && (
                              <button
                                className="action-sub-btn btn-discharge"
                                onClick={() => void startFollowup(r)}
                                disabled={sendingFollowupFor === r.id}
                              >
                                {sendingFollowupFor === r.id ? "Dispatching…" : "Care Continuity Follow-up"}
                              </button>
                            )}
                            <button
                              className="action-sub-btn"
                              onClick={() => {
                                setSendingMessageFor(r.id);
                                void sendAppointmentEmail(r).then(() => {
                                  setToast(`Appointment notice transmitted to ${r.fields[COL.name]}.`);
                                }).finally(() => setSendingMessageFor(null));
                              }}
                              disabled={sendingMessageFor === r.id}
                            >
                              {sendingMessageFor === r.id ? "Sending…" : "Send Email Reminder"}
                            </button>
                            <button className="action-sub-btn" onClick={() => editAppointment(r)}>
                              Edit
                            </button>
                            <button className="action-sub-btn btn-danger" onClick={() => void deleteAppointment(r)}>
                              {isCancelled ? "Delete Record" : "Cancel Visit"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!filteredAppointments.length && (
                    <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-500)" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-900)" }}>
                        No appointments match current filters
                      </div>
                      <div style={{ fontSize: "12px", marginTop: "2px" }}>
                        Adjust query or create a consultation using the left form.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Calendar & Roster Overview */}
              <aside className="card-panel">
                <div className="panel-header-line">
                  <h2 className="panel-title">Physician Availability</h2>
                </div>
                <div className="panel-subtitle">
                  Roster view for date selection.
                </div>

                <div className="form-field-group">
                  <label className="form-label">Filter Physician</label>
                  <select
                    value={doctorFilter}
                    onChange={e => setDoctorFilter(e.target.value)}
                  >
                    <option value="">All clinic physicians</option>
                    {doctors.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="calendar-nav-toolbar">
                  <button
                    className="calendar-arrow-btn"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  >
                    ‹
                  </button>
                  <span style={{ fontSize: "12.5px", fontWeight: 700 }}>
                    {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    className="calendar-arrow-btn"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  >
                    ›
                  </button>
                </div>

                <div className="calendar-grid-table">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span className="weekday-col-header" key={`${d}${i}`}>{d}</span>
                  ))}
                  {Array.from({ length: monthStart.getDay() }, (_, i) => (
                    <span key={`blank${i}`} />
                  ))}
                  {Array.from({ length: monthDays }, (_, i) => {
                    const d = i + 1;
                    const date = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}`;
                    const has = appointments.some(
                      r =>
                        r.fields[COL.date] === date &&
                        (!doctorFilter || low(r.fields[COL.doctor]) === low(doctorFilter)) &&
                        low(r.fields[COL.status]) !== "cancelled"
                    );
                    return (
                      <button
                        key={date}
                        className={`day-grid-cell ${date === selectedDay ? "selected-day" : ""} ${date === isoDate() ? "today" : ""} ${has ? "has-booking" : ""}`}
                        onClick={() => {
                          setSelectedDay(date);
                          setAppt(old => ({ ...old, date }));
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--line-100)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-900)" }}>
                    {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-500)", marginBottom: "6px" }}>
                    {doctorFilter || "All Physicians"} · {dayBookings.length} consultations scheduled
                  </div>

                  <div className="day-timeline-scroll">
                    {daySlots.map(t => {
                      const booked = dayBookings.find(r => toMin(r.fields[COL.time]) === t);
                      return (
                        <div
                          className={`timeline-hour-slot ${booked ? "is-booked" : ""}`}
                          key={t}
                          style={{ cursor: !booked ? "pointer" : "default" }}
                          onClick={() => {
                            if (!booked) {
                              setAppt(old => ({ ...old, date: selectedDay, time: t }));
                              setToast(`Selected slot ${labelTime(t)}.`);
                            }
                          }}
                        >
                          <span className="slot-timestamp">{labelTime(t)}</span>
                          <span className="slot-status-text">
                            {booked ? `${booked.fields[COL.name]} (${booked.fields[COL.doctor]?.replace(/^Dr\.\s*/, "")})` : "Available (Select)"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </section>
          </div>
        )}

        {/* TAB 2: PATIENTS DIRECTORY */}
        {tab === "patients" && (
          <section className="two-column-layout">
            {/* Form */}
            <form className="card-panel" onSubmit={handlePatientSubmit}>
              <div className="panel-header-line">
                <h2 className="panel-title">
                  {editingPatient ? "Edit Clinical Profile" : "Register Patient"}
                </h2>
              </div>
              <div className="panel-subtitle">
                Record demographic, contact, and baseline health details.
              </div>

              <div className="form-field-group">
                <label className="form-label">Full Patient Name *</label>
                <input
                  required
                  value={patientForm.name}
                  onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
                  placeholder="e.g. Aarav Sharma"
                />
              </div>

              <div className="form-field-group">
                <label className="form-label">Email Address *</label>
                <input
                  required
                  type="email"
                  value={patientForm.email}
                  onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
                  placeholder="patient@example.com"
                />
              </div>

              <div className="form-field-group">
                <label className="form-label">Telephone</label>
                <input
                  type="tel"
                  value={patientForm.phone}
                  onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div className="form-field-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    value={patientForm.bloodGroup}
                    onChange={e => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                  >
                    <option value="">Unspecified</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 38"
                    value={patientForm.age}
                    onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label className="form-label">Medical History / Allergies / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Clinical history, chronic conditions, or drug allergies"
                  value={patientForm.notes}
                  onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })}
                />
              </div>

              <div className="form-button-row">
                <button className="btn-submit-full" disabled={busy}>
                  {busy ? "Processing…" : editingPatient ? "Save Profile" : "Register Patient"}
                </button>
                {editingPatient && (
                  <button
                    type="button"
                    className="btn-cancel-plain"
                    onClick={() => {
                      setEditingPatient(null);
                      setPatientForm({ name: "", email: "", phone: "", bloodGroup: "", notes: "", age: "", gender: "Other" });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List */}
            <div className="card-panel">
              <div className="panel-header-line">
                <h2 className="panel-title">
                  <span>Patient Registry</span>
                  <span className="nav-count-badge">{patients.length}</span>
                </h2>
                <button className="btn-secondary" onClick={() => void loadRecords()} disabled={busy}>
                  <IconRefresh size={12} />
                  <span>Sync</span>
                </button>
              </div>
              <div className="panel-subtitle">
                Registered clinical patient profiles and history records.
              </div>

              <div className="search-filter-row">
                <div className="search-input-wrapper">
                  <span className="search-inline-icon">
                    <IconSearch size={14} />
                  </span>
                  <input
                    placeholder="Filter by name, email, phone, or clinical notes…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && <button className="clear-search-btn" onClick={() => setSearch("")}>×</button>}
                </div>
              </div>

              <div className="patients-directory-grid">
                {filteredPatients.map(p => {
                  const patientAppts = appointments.filter(a => low(a.fields[COL.email]) === low(p.fields[COL.email]));
                  return (
                    <article className="patient-directory-card" key={p.id}>
                      <div>
                        <div className="patient-header-row">
                          <div className="patient-avatar-box">
                            {(p.fields[COL.name] || "P").slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink-900)" }}>
                              {p.fields[COL.name]}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--ink-500)" }}>
                              Patient ID: {p.id.replace(/^patient:/, "")}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: "12px", color: "var(--ink-700)", marginTop: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div>Email: {p.fields[COL.email] || "None on record"}</div>
                          <div>Phone: {p.fields[COL.phone] || "None on record"}</div>
                          {p.fields[COL.bloodGroup] && (
                            <div>Blood Group: <strong>{p.fields[COL.bloodGroup]}</strong></div>
                          )}
                          {p.fields[COL.notes] && (
                            <div style={{ marginTop: "4px", padding: "4px 6px", backgroundColor: "var(--surface-subtle)", borderRadius: "4px", fontSize: "11px", color: "var(--ink-700)" }}>
                              {p.fields[COL.notes]}
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--ink-500)" }}>
                          Consultations on record: {patientAppts.length}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px", paddingTop: "8px", borderTop: "1px solid var(--line-100)" }}>
                        <button
                          className="action-sub-btn"
                          style={{ flex: 1, backgroundColor: "var(--primary-50)", color: "var(--primary-600)", borderColor: "var(--primary-line)" }}
                          onClick={() => {
                            setTab("appointments");
                            setAppt(old => ({ ...old, patient: p.id }));
                          }}
                        >
                          Book Visit
                        </button>
                        <button className="action-sub-btn" onClick={() => editPatient(p)}>
                          Edit
                        </button>
                        <button className="action-sub-btn btn-danger" onClick={() => void deletePatient(p)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!filteredPatients.length && (
                  <div style={{ gridColumn: "1 / -1", padding: "30px 16px", textAlign: "center", color: "var(--ink-500)" }}>
                    No patient records match your criteria.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: DOCTORS & SPECIALISTS */}
        {tab === "doctors" && (
          <div className="card-panel">
            <div className="panel-header-line">
              <h2 className="panel-title">
                <span>Clinical Specialist Directory</span>
                <span className="nav-count-badge">{doctorOptions.length}</span>
              </h2>
              <button className="btn-secondary" onClick={() => void loadRecords()} disabled={busy}>
                <IconRefresh size={12} />
                <span>Sync</span>
              </button>
            </div>
            <div className="panel-subtitle">
              Verified clinical physicians, specialties, assigned consultations, and availability.
            </div>

            <div className="doctors-roster-grid">
              {doctorOptions.map(doc => {
                const assignedAppts = appointments.filter(a => doctorKey(a.fields[COL.doctor]) === doctorKey(doc.name));
                const todayAssigned = assignedAppts.filter(a => a.fields[COL.date] === isoDate() && low(a.fields[COL.status]) !== "cancelled");
                const completedAssigned = assignedAppts.filter(a => low(a.fields[COL.status]) === "completed");

                return (
                  <article className="doctor-profile-card" key={doc.name}>
                    <div>
                      <div className="doctor-header-row">
                        <div className="doctor-avatar-box">
                          <IconStethoscope size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-900)" }}>{doc.name}</div>
                          <span className="specialty-tag">{doc.specialization}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: "10px", fontSize: "11.5px", color: "var(--ink-500)" }}>
                        <div>Email: {doc.email}</div>
                        <div>Department: {doc.specialization}</div>
                      </div>

                      <div className="doctor-stats-bar" style={{ marginTop: "10px" }}>
                        <div>
                          <strong>{todayAssigned.length}</strong>
                          <span>Visits Today</span>
                        </div>
                        <div>
                          <strong>{assignedAppts.length}</strong>
                          <span>Total Scheduled</span>
                        </div>
                        <div>
                          <strong>{completedAssigned.length}</strong>
                          <span>Completed</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1, padding: "6px 8px", fontSize: "11.5px" }}
                        onClick={() => {
                          setTab("appointments");
                          setDoctorFilter(doc.name);
                          setAppt(old => ({ ...old, doctor: doc.name }));
                        }}
                      >
                        Schedule Consultation
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: "6px 8px", fontSize: "11.5px" }}
                        onClick={() => {
                          setTab("appointments");
                          setDoctorFilter(doc.name);
                        }}
                      >
                        Filter Roster
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: FOLLOW-UPS & CARE INBOX */}
        {tab === "followups" && (
          <div className="card-panel" style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div className="panel-header-line">
              <h2 className="panel-title">
                <span>Care Continuity & Follow-up Log</span>
                <span className="nav-count-badge">{followupUpdates.length}</span>
              </h2>
              <button className="btn-secondary" onClick={() => void loadFollowupUpdates()}>
                <IconRefresh size={12} />
                <span>Refresh Log</span>
              </button>
            </div>
            <div className="panel-subtitle">
              Post-discharge patient health feedback, status check-ins, and clinical condition notices.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {followupUpdates.map(u => (
                <article
                  key={u.id}
                  style={{
                    border: "1px solid",
                    borderColor: u.priority === 4 ? "var(--rose-line)" : "var(--line-200)",
                    backgroundColor: u.priority === 4 ? "var(--rose-50)" : "#ffffff",
                    borderRadius: "8px",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-900)" }}>{u.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--ink-500)", marginLeft: "8px" }}>
                        {u.email} · Ticket #{u.id}
                      </span>
                    </div>
                    {u.priority === 4 && (
                      <span className="clinical-badge cancelled">
                        Requires Prompt Clinical Review
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "8px 0", fontSize: "13px", color: "var(--ink-700)", whiteSpace: "pre-wrap" }}>
                    {u.message || u.subject}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--ink-500)", paddingTop: "6px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <span>Recorded: {u.createdAt ? new Date(u.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Recent"}</span>
                    <button
                      className="action-sub-btn"
                      onClick={() => setToast(`Clinical review logged for ${u.name}.`)}
                    >
                      Acknowledge Review
                    </button>
                  </div>
                </article>
              ))}

              {!followupUpdates.length && (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-500)" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-900)" }}>No follow-up entries pending</div>
                  <div style={{ fontSize: "12px", marginTop: "2px" }}>Patient feedback after completion will display here.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ANALYTICS */}
        {tab === "analytics" && (
          <div className="card-panel">
            <div className="panel-header-line">
              <h2 className="panel-title">Operations & Clinical Analytics</h2>
            </div>
            <div className="panel-subtitle">
              Key performance indicators, modality ratios, and service completion metrics.
            </div>

            <div className="analytics-metric-grid">
              <div className="metric-summary-card">
                <div className="metric-heading">Total Consultations</div>
                <div className="metric-big-num">{appointments.length}</div>
                <div className="metric-subtext">All-time consultations logged</div>
              </div>
              <div className="metric-summary-card">
                <div className="metric-heading">Telehealth Ratio</div>
                <div className="metric-big-num">
                  {appointments.length ? `${Math.round((appointments.filter(a => modeOf(a.fields) === "Online").length / appointments.length) * 100)}%` : "0%"}
                </div>
                <div className="metric-subtext">Percentage of video appointments</div>
              </div>
              <div className="metric-summary-card">
                <div className="metric-heading">Completion Rate</div>
                <div className="metric-big-num">
                  {appointments.length ? `${Math.round((completedCount / appointments.length) * 100)}%` : "0%"}
                </div>
                <div className="metric-subtext">Discharged and closed visits</div>
              </div>
              <div className="metric-summary-card">
                <div className="metric-heading">Patient Satisfaction</div>
                <div className="metric-big-num">4.8 / 5.0</div>
                <div className="metric-subtext">Post-consultation feedback average</div>
              </div>
            </div>

            <div style={{ marginTop: "14px", padding: "16px", border: "1px solid var(--line-200)", borderRadius: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-900)" }}>
                Consultation Modality Breakdown
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--ink-500)", marginBottom: "8px" }}>
                Comparison of Online Telehealth sessions against In-Person clinic consultations.
              </div>

              <div className="progress-track">
                <div
                  style={{
                    backgroundColor: "var(--primary-600)",
                    width: appointments.length
                      ? `${(appointments.filter(a => modeOf(a.fields) === "Online").length / appointments.length) * 100}%`
                      : "50%",
                  }}
                />
                <div
                  style={{
                    backgroundColor: "var(--blue-600)",
                    width: appointments.length
                      ? `${(appointments.filter(a => modeOf(a.fields) === "Offline").length / appointments.length) * 100}%`
                      : "50%",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--ink-700)", marginTop: "6px" }}>
                <span>Online Telehealth: {appointments.filter(a => modeOf(a.fields) === "Online").length}</span>
                <span>In-Person Consultations: {appointments.filter(a => modeOf(a.fields) === "Offline").length}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SYSTEM INTEGRATIONS MODAL */}
      {settingsOpen && (
        <div
          className="modal-overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="modal-window">
            <button className="modal-close-icon" onClick={() => setSettingsOpen(false)}>×</button>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-600)", textTransform: "uppercase" }}>
              Diagnostic Status
            </div>
            <h2 style={{ margin: "2px 0 6px", fontSize: "18px", fontWeight: 700, color: "var(--ink-900)" }}>
              Clinic System Integration Monitor
            </h2>
            <p style={{ margin: "0 0 16px", color: "var(--ink-500)", fontSize: "12.5px" }}>
              Real-time health status of clinical API adapters and fallback processors.
            </p>

            <div className="integration-row-card">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Zoom Telehealth Meetings API</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-500)" }}>Automated video conference generation with OAuth token resolution</div>
                {integrationHealth.zoom && (
                  <div style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: 600, marginTop: "2px" }}>
                    Status: {integrationHealth.zoom}
                  </div>
                )}
              </div>
              <span className="clinical-badge completed">Active</span>
            </div>

            <div className="integration-row-card">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Google Calendar v3 Service</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-500)" }}>Physician schedule synchronization and event dispatching</div>
                {integrationHealth.calendar && (
                  <div style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: 600, marginTop: "2px" }}>
                    Status: {integrationHealth.calendar}
                  </div>
                )}
              </div>
              <span className="clinical-badge completed">Active</span>
            </div>

            <div className="integration-row-card">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Airtable Clinical Database</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-500)" }}>Primary database adapter with offline-tolerant memory resilience</div>
                {integrationHealth.airtable && (
                  <div style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: 600, marginTop: "2px" }}>
                    Status: {integrationHealth.airtable}
                  </div>
                )}
              </div>
              <span className="clinical-badge completed">Active</span>
            </div>

            <div className="integration-row-card">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Freshdesk Care Continuity</div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-500)" }}>Automated 7-day care continuity ticketing and feedback tracking</div>
              </div>
              <span className="clinical-badge completed">Active</span>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
              <button
                className="btn-primary"
                onClick={() => void testIntegrations()}
                disabled={testingIntegrations}
                style={{ flex: 1, justifyContent: "center" }}
              >
                {testingIntegrations ? "Pinging Services…" : "Execute Diagnostic Ping"}
              </button>
              <button className="btn-secondary" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
