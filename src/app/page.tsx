"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Fields = Record<string, string>;
type RecordItem = { id: string; fields: Fields };
type ClinicUser = { email: string; name: string; role: "doctor" | "receptionist"; doctorName?: string };
type FollowupUpdate = { id: string; subject: string; email: string; name: string; message: string; createdAt: string; priority: number };
type DoctorOption = { name: string; specialization: string; email: string };
const COL = { name: "Patient Name", email: "Patient Email", phone: "Phone No", date: "Appointment Date", time: "Appointment Time", doctor: "Doctor", status: "Status", mode: "Mode", zoomId: "Zoom Meeting ID", zoomUrl: "Zoom Join URL", calendarId: "Google Calendar Event ID" };
const START = 9 * 60, END = 18 * 60, SLOT = 30;
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const labelTime = (n: number) => `${(Math.floor(n / 60) + 11) % 12 + 1}:${pad(n % 60)} ${n < 720 ? "AM" : "PM"}`;
const toMin = (s?: string) => { const m = String(s || "").match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i); if (!m) return null; let h = +m[1]; if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12; if (m[3]?.toLowerCase() === "am" && h === 12) h = 0; return h * 60 + +m[2]; };
const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const low = (s?: string) => (s || "").trim().toLowerCase();
const doctorKey = (s?: string) => low(s).replace(/^dr\.?\s*/, "");
const isRegistered = (r: RecordItem) => low(r.fields[COL.status]) === "registered" && !r.fields[COL.date];
const modeOf = (f: Fields) => f[COL.mode] || (f[COL.zoomId] ? "Online" : "Offline");

function LoginScreen({ onLogin }: { onLogin: (user: ClinicUser) => void }) {
  const [role, setRole] = useState<"doctor" | "receptionist">("receptionist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not sign in.");
      onLogin(body.user);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><span className="brand-mark clinic-logo-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" fill="currentColor"/></svg></span><span><b>Clinic Desk</b><small>Care, coordinated.</small></span></div>
    <div className="eyebrow">WELCOME BACK</div><h1>Sign in to your clinic</h1><p className="login-intro">Choose your workspace, then enter your account details.</p>
    <div className="role-choice" role="radiogroup" aria-label="Sign in as">
      <button type="button" role="radio" aria-checked={role === "receptionist"} className={role === "receptionist" ? "role-card selected" : "role-card"} onClick={() => setRole("receptionist")}><span className="role-icon">▤</span><b>Receptionist</b><small>Patients and appointments</small></button>
      <button type="button" role="radio" aria-checked={role === "doctor"} className={role === "doctor" ? "role-card selected" : "role-card"} onClick={() => setRole("doctor")}><span className="role-icon">✚</span><b>Doctor</b><small>Your schedule and visits</small></button>
    </div>
    <label>Email address<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@clinic.com" /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="login-submit" disabled={busy}>{busy ? "Signing in…" : `Continue as ${role}`}</button>
    <p className="login-footnote">Your clinic account determines which workspace you can access.</p>
  </form></main>;
}

function FollowupInbox({ updates, onRefresh }: { updates: FollowupUpdate[]; onRefresh: () => void }) {
  return <section className="panel followup-inbox"><div className="panel-heading"><div><div className="eyebrow">SHARED CARE INBOX</div><h2>Patient health updates <span className="count">{updates.length}</span></h2></div><button className="refresh" onClick={onRefresh}>↻ Refresh</button></div><p className="muted">Patient feedback and health changes from Freshdesk are shared with the care team.</p><div className="list">{updates.map(update => <article className={update.priority === 4 ? "followup-update urgent" : "followup-update"} key={update.id}><div className="followup-update-head"><b>{update.name}</b><span>{update.createdAt ? new Date(update.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Just received"}</span></div><div className="followup-update-sub">{update.email} · Ticket #{update.id}{update.priority === 4 && <strong> · Needs prompt review</strong>}</div><p>{update.message || update.subject}</p></article>)}{!updates.length && <div className="empty"><span>♡</span><b>No new health updates</b><p>Patient feedback and reported changes will show here.</p></div>}</div></section>;
}

export default function Home() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [user, setUser] = useState<ClinicUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [tab, setTab] = useState<"patients" | "appointments" | "followups">("patients");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [editingPatient, setEditingPatient] = useState<string | null>(null);
  const [editingAppt, setEditingAppt] = useState<string | null>(null);
  const [patientForm, setPatientForm] = useState({ name: "", email: "", phone: "" });
  const [appt, setAppt] = useState({ patient: "", doctor: "", date: "", time: null as number | null, mode: "Offline", status: "Scheduled" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingMessageFor, setSendingMessageFor] = useState<string | null>(null);
  const [sendingFollowupFor, setSendingFollowupFor] = useState<string | null>(null);
  const [followupUpdates, setFollowupUpdates] = useState<FollowupUpdate[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(isoDate());
  const [doctorFilter, setDoctorFilter] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(body => setUser(body.user || null)).catch(() => setUser(null)).finally(() => setSessionLoading(false));
  }, []);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 5000); return () => clearTimeout(id); } }, [toast]);
  useEffect(() => {
    if (!user) return;
    void fetch("/api/clinic/doctors").then(r => r.json()).then(body => setDoctorOptions(body.doctors || [])).catch(() => setDoctorOptions([]));
  }, [user]);
  useEffect(() => {
    if (!user) return;
    void loadRecords();
    const id = setInterval(() => void loadRecords(true), 30_000);
    return () => clearInterval(id);
  }, [user]);
  useEffect(() => { if (!user) return; void loadFollowupUpdates(true); const id = setInterval(() => void loadFollowupUpdates(true), 15_000); return () => clearInterval(id); }, [user]);

  const patients = useMemo(() => {
    const byKey = new Map<string, RecordItem>();
    for (const r of records) {
      const f = r.fields, key = low(f[COL.email]) || low(f[COL.name]); if (!key) continue;
      const prior = byKey.get(key);
      if (!prior || isRegistered(r)) byKey.set(key, { id: isRegistered(r) ? r.id : prior?.id || `patient:${key}`, fields: { ...prior?.fields, ...f } });
    }
    return [...byKey.values()].sort((a, b) => (a.fields[COL.name] || "").localeCompare(b.fields[COL.name] || ""));
  }, [records]);
  const appointments = useMemo(() => records.filter(r => !isRegistered(r)), [records]);
  const doctors = useMemo(() => [...new Set(appointments.map(r => r.fields[COL.doctor]).filter(Boolean))].sort(), [appointments]);
  const todayAppointments = appointments.filter(r => r.fields[COL.date] === isoDate() && low(r.fields[COL.status]) !== "cancelled");
  const onlineUpcoming = appointments.filter(r => modeOf(r.fields) === "Online" && (r.fields[COL.date] || "") >= isoDate() && low(r.fields[COL.status]) !== "cancelled");

  async function startFollowup(record: RecordItem) {
    const f = record.fields;
    if (!f[COL.email]) return setToast(`Add an email address for ${f[COL.name] || "this patient"} before sending a follow-up.`);
    setSendingFollowupFor(record.id);
    try {
      const response = await fetch("/api/follow-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: record.id, name: f[COL.name], email: f[COL.email], doctor: f[COL.doctor], status: f[COL.status] }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not send the follow-up email.");
      setToast(`Seven-day follow-up email sent to ${f[COL.name]}. Freshdesk ticket #${body.ticketId} created.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not send the follow-up email."); }
    finally { setSendingFollowupFor(null); }
  }
  async function sendAppointmentEmail(record: RecordItem) {
    const f = record.fields;
    const online = modeOf(f) === "Online";
    const response = await fetch("/api/appointments/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: record.id, name: f[COL.name], email: f[COL.email], doctor: f[COL.doctor], date: f[COL.date], time: f[COL.time], mode: online ? "Online" : "Offline", ...(online ? { zoomId: f[COL.zoomId], zoomUrl: f[COL.zoomUrl] } : {}), status: f[COL.status] }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Appointment email could not be sent.");
  }
  async function loadFollowupUpdates(silent = false) {
    try {
      const response = await fetch("/api/follow-up/inbox");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load patient updates.");
      setFollowupUpdates(body.updates || []);
    } catch (error) { if (!silent) setToast(error instanceof Error ? error.message : "Could not load patient updates."); }
  }
  async function loadRecords(silent = false) {
    setBusy(true);
    try { const response = await fetch("/api/clinic/records"); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Could not load clinic data."); setRecords(body.records || []); if (!silent) setToast(`Loaded ${(body.records || []).length} records from Airtable.`); }
    catch (e) { if (!silent) setToast(e instanceof Error ? e.message : "Could not load clinic data."); }
    finally { setBusy(false); }
  }
  async function saveRecord(id: string | null, fields: Fields, clearFields: string[] = []) {
    const response = await fetch(id ? `/api/clinic/records?id=${encodeURIComponent(id)}` : "/api/clinic/records", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields, clearFields }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not save Airtable record.");
    return body as RecordItem;
  }
  async function removeRecord(id: string) {
    const response = await fetch(`/api/clinic/records?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Could not delete record (${response.status})`);
  }
  async function zoomCall(method: string, path: string, appointmentMode: "Online", body?: Record<string, string | number>) {
    let response: Response;
    try { response = await fetch(`/api/zoom${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, appointmentMode }) }); }
    catch { throw new Error("Could not reach the clinic server to contact Zoom."); }
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!response.ok) {
      const detail = typeof data.error === "string" ? data.error : data.error?.message || data.message || data.detail;
      throw new Error(detail ? `Zoom service: ${detail}` : `Zoom service rejected the meeting request (HTTP ${response.status}). Check the service console for its validation details.`);
    }
    return data;
  }
  async function calendarCall(body: Record<string, string | number>) {
    const response = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Google Calendar update failed.");
    return data;
  }
  async function sendAppointmentMessage(record: RecordItem) {
    const fields = record.fields;
    setSendingMessageFor(record.id);
    try {
      await sendAppointmentEmail(record);
      setToast(`Appointment email sent to ${fields[COL.name]}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not send the appointment message.");
    } finally { setSendingMessageFor(null); }
  }
  async function handlePatientSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientForm.name.trim() || !patientForm.email.trim()) return setToast("Enter the patient's name and email.");
    if (patients.some(p => p.id !== editingPatient && low(p.fields[COL.email]) === low(patientForm.email))) return setToast("A patient with this email is already registered.");
    setBusy(true);
    try { const fields: Fields = { [COL.name]: patientForm.name.trim(), [COL.email]: patientForm.email.trim(), [COL.phone]: patientForm.phone.trim(), [COL.status]: "Registered" }; const saved = await saveRecord(editingPatient, fields); setRecords(old => editingPatient ? old.map(r => r.id === saved.id ? saved : r) : [saved, ...old]); setPatientForm({ name: "", email: "", phone: "" }); setEditingPatient(null); setToast(editingPatient ? "Patient updated." : "Patient registered."); }
    catch (e) { setToast(e instanceof Error ? e.message : "Could not save patient."); } finally { setBusy(false); }
  }
  async function handleAppointmentSubmit(e: FormEvent) {
    e.preventDefault();
    const patient = patients.find(p => p.id === appt.patient) || records.find(r => r.id === editingAppt);
    if (!patient || !appt.doctor.trim() || !appt.date || appt.time === null) return setToast("Choose a patient, doctor, date, and available time.");
    if (!patient.fields[COL.email]) return setToast("Add the patient's email address before booking so both the patient and doctor can receive appointment details.");
    if (!doctorOptions.some(doctor => low(doctor.name) === low(appt.doctor))) return setToast("Choose a doctor from the configured clinic doctor list.");
    const conflict = appointments.find(r => r.id !== editingAppt && low(r.fields[COL.status]) !== "cancelled" && r.fields[COL.date] === appt.date && low(r.fields[COL.doctor]) === low(appt.doctor) && toMin(r.fields[COL.time]) === appt.time);
    if (conflict) return setToast("That doctor already has an appointment at this time.");
    const f = patient.fields;
    const existing = editingAppt ? appointments.find(r => r.id === editingAppt) : undefined;
    // Mode is optional for older Airtable bases and the server drops unknown columns.
    const fields: Fields = { [COL.name]: f[COL.name], [COL.email]: f[COL.email] || "", [COL.phone]: f[COL.phone] || "", [COL.date]: appt.date, [COL.time]: hm(appt.time), [COL.doctor]: appt.doctor.trim(), [COL.status]: appt.status, [COL.mode]: appt.mode };
    setBusy(true);
    try {
      const shouldHaveZoom = appt.mode === "Online" && low(appt.status) !== "cancelled";
      const hadZoom = existing?.fields[COL.zoomId];
      const priorCalendarId = existing?.fields[COL.calendarId];
      const meetingStart = `${appt.date}T${hm(appt.time)}:00`;
      if (shouldHaveZoom) {
        if (hadZoom) await zoomCall("PATCH", `/meetings/${hadZoom}`, "Online", { start_time: meetingStart, timezone: "Asia/Kolkata", topic: `Appointment: ${f[COL.name]} with ${appt.doctor}` });
        else { const meeting = await zoomCall("POST", "/meetings", "Online", { topic: `Appointment: ${f[COL.name]} with ${appt.doctor}`, start_time: meetingStart, timezone: "Asia/Kolkata", duration: SLOT }); fields[COL.zoomId] = String(meeting.id); fields[COL.zoomUrl] = meeting.join_url; }
      }
      if (low(appt.status) === "cancelled" && appt.mode === "Online" && existing && existing.fields[COL.mode] === "Online" && hadZoom) await zoomCall("DELETE", `/meetings/${hadZoom}`, "Online");
      if (low(appt.status) === "cancelled") {
        if (priorCalendarId) await calendarCall({ action: "delete", existingEventId: priorCalendarId });
        fields[COL.calendarId] = "";
      } else {
        const calendar = await calendarCall({ date: appt.date, time: hm(appt.time), duration: SLOT, name: f[COL.name], email: f[COL.email], doctor: appt.doctor, mode: appt.mode, existingEventId: priorCalendarId || "" });
        fields[COL.calendarId] = calendar.eventId;
      }
      const clearZoomFields = appt.mode === "Offline" || low(appt.status) === "cancelled" ? [COL.zoomId, COL.zoomUrl] : [];
      const saved = await saveRecord(editingAppt, fields, clearZoomFields);
      setRecords(old => editingAppt ? old.map(r => r.id === saved.id ? saved : r) : [saved, ...old]);
      if (["scheduled", "cancelled"].includes(low(fields[COL.status]))) {
        void sendAppointmentEmail({ ...saved, fields: { ...fields, ...saved.fields } }).then(() => setToast("Appointment saved. Patient and doctor were emailed."))
          .catch(error => setToast(`Appointment saved, but email failed: ${error instanceof Error ? error.message : "check Freshdesk setup"}`));
      }
      setToast(editingAppt ? "Appointment updated." : "Appointment booked.");
      setSelectedDay(appt.date); setMonth(new Date(`${appt.date}T00:00:00`)); setEditingAppt(null); setAppt({ patient: "", doctor: "", date: "", time: null, mode: "Offline", status: "Scheduled" });
    } catch (e) { setToast(e instanceof Error ? e.message : "Could not save appointment."); } finally { setBusy(false); }
  }
  async function deletePatient(patient: RecordItem) {
    if (!patient.id || patient.id.startsWith("patient:")) return setToast("Delete this patient's appointments before removing them.");
    if (appointments.some(r => low(r.fields[COL.status]) !== "cancelled" && low(r.fields[COL.email]) === low(patient.fields[COL.email]))) return setToast("Cancel or delete this patient's active appointments first.");
    if (!window.confirm(`Delete ${patient.fields[COL.name]}?`)) return;
    try { await removeRecord(patient.id); setRecords(old => old.filter(r => r.id !== patient.id)); setToast("Patient deleted."); } catch (e) { setToast(e instanceof Error ? e.message : "Could not delete patient."); }
  }
  async function deleteAppointment(r: RecordItem) {
    if (!window.confirm(`Delete the appointment for ${r.fields[COL.name]}?`)) return;
    try { if (r.fields[COL.mode] === "Online" && r.fields[COL.zoomId]) await zoomCall("DELETE", `/meetings/${r.fields[COL.zoomId]}`, "Online"); if (r.fields[COL.calendarId]) await calendarCall({ action: "delete", existingEventId: r.fields[COL.calendarId] }); await removeRecord(r.id); setRecords(old => old.filter(item => item.id !== r.id)); setToast("Appointment deleted."); } catch (e) { setToast(e instanceof Error ? e.message : "Could not delete appointment."); }
  }
  function editPatient(p: RecordItem) { setEditingPatient(p.id); setPatientForm({ name: p.fields[COL.name] || "", email: p.fields[COL.email] || "", phone: p.fields[COL.phone] || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function editAppointment(r: RecordItem) { setEditingAppt(r.id); const p = patients.find(x => low(x.fields[COL.email]) === low(r.fields[COL.email])); setAppt({ patient: p?.id || "", doctor: r.fields[COL.doctor] || "", date: r.fields[COL.date] || "", time: toMin(r.fields[COL.time]), mode: modeOf(r.fields), status: r.fields[COL.status] || "Scheduled" }); setTab("appointments"); }
  const filteredPatients = patients.filter(p => [p.fields[COL.name], p.fields[COL.email], p.fields[COL.phone]].some(x => low(x).includes(low(search))));
  const filteredAppointments = appointments.filter(r => [r.fields[COL.name], r.fields[COL.doctor], r.fields[COL.email]].some(x => low(x).includes(low(search)))).sort((a, b) => `${b.fields[COL.date]}${b.fields[COL.time]}`.localeCompare(`${a.fields[COL.date]}${a.fields[COL.time]}`));
  const daySlots = Array.from({ length: (END - START) / SLOT }, (_, i) => START + i * SLOT);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1), monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dayBookings = appointments.filter(r => r.fields[COL.date] === selectedDay && (!doctorFilter || r.fields[COL.doctor] === doctorFilter) && low(r.fields[COL.status]) !== "cancelled");

    const healthUpdatesPanel = <FollowupInbox updates={followupUpdates} onRefresh={() => void loadFollowupUpdates()} />;

if (sessionLoading) return <main className="login-shell"><div className="login-card login-loading">Opening Clinic Desk…</div></main>;
  if (!user) return <LoginScreen onLogin={setUser} />;


  const doctorNameKey = doctorKey(user.doctorName || user.name);
  const doctorAppointments = filteredAppointments.filter(r => {
    const assignedDoctor = doctorKey(r.fields[COL.doctor]);
    return assignedDoctor === doctorNameKey;
  });
  const doctorToday = doctorAppointments.filter(r => r.fields[COL.date] === isoDate() && low(r.fields[COL.status]) !== "cancelled");
  async function signOut() { await fetch("/api/auth/session", { method: "DELETE" }); setUser(null); setRecords([]); }
  if (user.role === "doctor") return <><header className="topbar"><div className="brand"><span className="brand-mark clinic-logo-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" fill="currentColor"/></svg></span><span><b>Clinic Desk</b><small>Doctor workspace</small></span></div><span className="welcome-user">{user.doctorName || user.name}</span><button className="settings-trigger" onClick={() => void signOut()}>Sign out</button></header><section className="hero"><div className="hero-inner"><div><div className="eyebrow">YOUR CLINIC DAY</div><h1>Good day, {user.doctorName || user.name}</h1><p>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><div className="stats"><div><strong>{doctorToday.length}</strong><span>Visits today</span></div><div><strong>{doctorAppointments.filter(r => (r.fields[COL.date] || "") >= isoDate() && low(r.fields[COL.status]) !== "cancelled").length}</strong><span>Upcoming visits</span></div><div><strong>{doctorAppointments.filter(r => low(r.fields[COL.status]) === "completed").length}</strong><span>Completed visits</span></div></div></div></section><main className="workspace"><section className="panel doctor-schedule"><div className="panel-heading"><div><div className="eyebrow">MY SCHEDULE</div><h2>Appointments <span className="count">{doctorAppointments.length}</span></h2></div><button className="refresh" onClick={() => void loadRecords()} disabled={busy}>↻ {busy ? "Loading" : "Refresh"}</button></div><div className="search"><span>⌕</span><input placeholder="Search your appointments" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="list">{doctorAppointments.map(r => <article className="appointment-row" key={r.id}><div className="date-badge"><b>{r.fields[COL.date] ? new Date(r.fields[COL.date]+"T00:00:00").getDate() : "–"}</b><span>{r.fields[COL.date] ? new Date(r.fields[COL.date]+"T00:00:00").toLocaleDateString("en-IN", { month: "short" }) : ""}</span></div><div className="person-copy"><b>{r.fields[COL.name]} <span className={"pill " + low(r.fields[COL.status])}>{r.fields[COL.status] || "Scheduled"}</span></b><span>{r.fields[COL.date] || "Date pending"} · {labelTime(toMin(r.fields[COL.time]) ?? 0)} · {modeOf(r.fields)}</span>{r.fields[COL.email] && <span>{r.fields[COL.email]}{r.fields[COL.phone] ? " · " + r.fields[COL.phone] : ""}</span>}{modeOf(r.fields) === "Online" && r.fields[COL.zoomUrl] && <a href={r.fields[COL.zoomUrl]} target="_blank" rel="noreferrer">Join Zoom meeting</a>}{low(r.fields[COL.status]) === "completed" && <button className="followup-send" disabled={sendingFollowupFor === r.id} onClick={() => void startFollowup(r)}>{sendingFollowupFor === r.id ? "Sending…" : "✉ Discharge & send follow-up"}</button>}</div></article>)}{!doctorAppointments.length && <div className="empty"><span>▦</span><b>{appointments.length ? "No visits match your search" : "Your schedule is clear"}</b><p>{appointments.length ? "Try another patient or date." : "Upcoming appointments will appear here."}</p></div>}</div></section><FollowupInbox updates={followupUpdates} onRefresh={() => void loadFollowupUpdates()} /></main></>;

  return <>
    <header className="topbar"><div className="brand"><span className="brand-mark clinic-logo-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" fill="currentColor"/></svg></span><span><b>Clinic Desk</b><small>Front desk and care coordination</small></span></div><nav className="tabs"><button className={tab === "patients" ? "active" : ""} onClick={() => { setTab("patients"); setSearch(""); }}>♧ <span>Patients</span></button><button className={tab === "appointments" ? "active" : ""} onClick={() => { setTab("appointments"); setSearch(""); }}>▦ <span>Appointments</span></button><button className={tab === "followups" ? "active" : ""} onClick={() => setTab("followups")}>♡ <span>Follow-ups{followupUpdates.length ? ` ${followupUpdates.length}` : ""}</span></button></nav><span className="welcome-user">{user.name}</span><button className="settings-trigger" onClick={() => setSettingsOpen(true)}>⚙ Settings</button><button className="settings-trigger" onClick={() => void signOut()}>Sign out</button></header>
    <section className="hero"><div className="hero-inner"><div><div className="eyebrow">CLINIC OVERVIEW</div><h1>Today at the clinic</h1><p>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><div className="stats"><div><strong>{patients.length}</strong><span>Registered patients</span></div><div><strong>{todayAppointments.length}</strong><span>Visits today</span></div><div><strong>{onlineUpcoming.length}</strong><span>Upcoming online visits</span></div></div><div className="hero-orb" /></div></section>
    <main className="workspace">
      {toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast("")}>×</button></div>}
      {tab === "followups" ? healthUpdatesPanel : tab === "patients" ? <section className="layout-two">
        <form className="panel form-panel" onSubmit={handlePatientSubmit}><div className="section-icon">♧</div><h2>{editingPatient ? "Edit patient" : "Register patient"}</h2><p className="muted">Register once, then book appointments in seconds.</p><label>Full name<input required value={patientForm.name} onChange={e => setPatientForm({ ...patientForm, name: e.target.value })} placeholder="e.g. Asha Sharma" /></label><label>Email address<input required type="email" value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} placeholder="asha@example.com" /></label><label>Phone number<input type="tel" value={patientForm.phone} onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} placeholder="+91 98765 43210" /></label><div className="actions"><button className="primary" disabled={busy}>{busy ? "Saving…" : editingPatient ? "Save changes" : "+ Register patient"}</button>{editingPatient && <button type="button" onClick={() => { setEditingPatient(null); setPatientForm({ name: "", email: "", phone: "" }); }}>Cancel</button>}</div><div className="note"><span>◉</span> Patient details are stored in your Airtable base.</div></form>
        <div className="panel list-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR CLINIC</div><h2>Registered patients <span className="count">{patients.length}</span></h2></div><button className="refresh" onClick={() => void loadRecords()} disabled={busy}>↻ {busy ? "Loading" : "Refresh"}</button></div><div className="search"><span>⌕</span><input placeholder="Search name, email or phone" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="list">{filteredPatients.map(p => <article className="person-row" key={p.id}><div className="avatar">{(p.fields[COL.name] || "?").slice(0, 1).toUpperCase()}</div><div className="person-copy"><b>{p.fields[COL.name]}</b><span>{p.fields[COL.email] || "No email"} · {p.fields[COL.phone] || "No phone"}</span></div><div className="row-actions"><button onClick={() => { setTab("appointments"); setAppt({ ...appt, patient: p.id }); }}>Book</button><button onClick={() => editPatient(p)}>Edit</button><button className="danger-link" onClick={() => void deletePatient(p)}>Delete</button></div></article>)}{!filteredPatients.length && <div className="empty"><span>♧</span><b>{patients.length ? "No patients match your search" : "Your patient list is ready"}</b><p>{patients.length ? "Try a different name or email." : "Register a patient to get started."}</p></div>}</div></div>
      </section> : <section className="layout-appt">
        <form className="panel form-panel appt-form" onSubmit={handleAppointmentSubmit}><div className="section-icon">▦</div><h2>{editingAppt ? "Edit appointment" : "Book appointment"}</h2><p className="muted">Choose an open slot on your doctor’s schedule.</p><label>Patient<select required value={appt.patient} onChange={e => setAppt({ ...appt, patient: e.target.value })}><option value="">Select a patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.fields[COL.name]}{p.fields[COL.email] ? ` · ${p.fields[COL.email]}` : ""}</option>)}</select></label>{!patients.length && <div className="inline-hint">No patients yet. <button type="button" onClick={() => setTab("patients")}>Register one first</button></div>}<label>Doctor<select required value={appt.doctor} onChange={e => setAppt({ ...appt, doctor: e.target.value })}><option value="">Select a doctor</option>{doctorOptions.map(d => <option key={d.name} value={d.name}>{d.name} · {d.specialization}</option>)}</select></label><label>Visit type</label><div className="segmented"><button type="button" className={appt.mode === "Online" ? "selected" : ""} onClick={() => setAppt({ ...appt, mode: "Online" })}>▣ Online</button><button type="button" className={appt.mode === "Offline" ? "selected" : ""} onClick={() => setAppt({ ...appt, mode: "Offline" })}>⌂ In person</button></div><div className="field-hint">{appt.mode === "Online" ? "A Zoom meeting is created automatically." : "In-person clinic visit. No Zoom meeting is created."}</div><label>Date<input required type="date" min={isoDate()} value={appt.date} onChange={e => setAppt({ ...appt, date: e.target.value, time: null })} /></label><label>Available time</label><div className="time-grid">{daySlots.map(t => { const taken = appointments.some(r => r.id !== editingAppt && low(r.fields[COL.status]) !== "cancelled" && r.fields[COL.date] === appt.date && low(r.fields[COL.doctor]) === low(appt.doctor) && toMin(r.fields[COL.time]) === t); const past = appt.date === isoDate() && t <= new Date().getHours() * 60 + new Date().getMinutes(); return <button type="button" key={t} disabled={!appt.date || !appt.doctor || taken || past} className={`${appt.time === t ? "chosen" : ""} ${taken ? "taken" : ""}`} onClick={() => setAppt({ ...appt, time: t })}>{labelTime(t)}</button>; })}</div>{editingAppt && <label>Status<select value={appt.status} onChange={e => setAppt({ ...appt, status: e.target.value })}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></label>}<div className="actions"><button className="primary" disabled={busy}>{busy ? "Saving…" : editingAppt ? "Save appointment" : "Book appointment"}</button>{editingAppt && <button type="button" onClick={() => { setEditingAppt(null); setAppt({ patient: "", doctor: "", date: "", time: null, mode: "Offline", status: "Scheduled" }); }}>Cancel</button>}</div></form>
        <div className="panel list-panel"><div className="panel-heading"><div><div className="eyebrow">SCHEDULE</div><h2>Appointments <span className="count">{appointments.length}</span></h2></div><button className="refresh" onClick={() => void loadRecords()} disabled={busy}>↻ Refresh</button></div><div className="search"><span>⌕</span><input placeholder="Search patient or doctor" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="list">{filteredAppointments.map(r => <article className="appointment-row" key={r.id}><div className="date-badge"><b>{r.fields[COL.date] ? new Date(`${r.fields[COL.date]}T00:00:00`).getDate() : "–"}</b><span>{r.fields[COL.date] ? new Date(`${r.fields[COL.date]}T00:00:00`).toLocaleDateString("en-IN", { month: "short" }) : ""}</span></div><div className="person-copy"><b>{r.fields[COL.name]} <span className={`pill ${low(r.fields[COL.status])}`}>{r.fields[COL.status] || "Scheduled"}</span></b><span>{labelTime(toMin(r.fields[COL.time]) ?? 0)} · {r.fields[COL.doctor]} · {modeOf(r.fields)}</span>{modeOf(r.fields) === "Online" && r.fields[COL.zoomUrl] && <a href={r.fields[COL.zoomUrl]} target="_blank" rel="noreferrer">Join Zoom meeting</a>}</div><div className="row-actions">{low(r.fields[COL.status]) === "completed" && <button onClick={() => void startFollowup(r)} disabled={sendingFollowupFor === r.id}>{sendingFollowupFor === r.id ? "Sending…" : "Discharge & follow-up"}</button>}<button onClick={() => void sendAppointmentMessage(r)} disabled={sendingMessageFor === r.id}>{sendingMessageFor === r.id ? "Sending…" : "Send message"}</button><button onClick={() => editAppointment(r)}>Edit</button><button className="danger-link" onClick={() => void deleteAppointment(r)}>Delete</button></div></article>)}{!filteredAppointments.length && <div className="empty"><span>▦</span><b>{appointments.length ? "No appointments match" : "No appointments yet"}</b><p>Book a visit using the form.</p></div>}</div></div>
        <aside className="panel calendar-panel"><div className="eyebrow">AVAILABILITY</div><h2>Doctor schedule</h2><label>Doctor<select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}><option value="">All doctors</option>{doctors.map(d => <option key={d}>{d}</option>)}</select></label><div className="calendar-head"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><b>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div><div className="calendar-grid">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span className="weekday" key={`${d}${i}`}>{d}</span>)}{Array.from({ length: monthStart.getDay() }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: monthDays }, (_, i) => { const d = i + 1, date = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}`, has = appointments.some(r => r.fields[COL.date] === date && (!doctorFilter || r.fields[COL.doctor] === doctorFilter) && low(r.fields[COL.status]) !== "cancelled"); return <button key={date} className={`${date === selectedDay ? "selected-day" : ""} ${date === isoDate() ? "today" : ""} ${has ? "has-booking" : ""}`} onClick={() => setSelectedDay(date)}>{d}</button>; })}</div><h3>{new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h3><p className="field-hint">{doctorFilter || "All doctors"} · {dayBookings.length} booked</p><div className="day-list">{daySlots.map(t => { const booked = dayBookings.find(r => toMin(r.fields[COL.time]) === t); return <div className={`day-slot ${booked ? "is-booked" : ""}`} key={t}><span>{labelTime(t)}</span><span>{booked ? `${booked.fields[COL.name]} · ${booked.fields[COL.doctor]}` : "Available"}</span></div>; })}</div></aside>
      </section>}
    </main>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><section className="modal"><button type="button" className="modal-close" onClick={() => setSettingsOpen(false)}>×</button><div className="eyebrow">CONNECTIONS</div><h2>Clinic integrations</h2><p className="muted">Clinic data and appointment services connect securely through the server.</p><div className="integration-callout"><b>Airtable · Google Calendar · Zoom · Freshdesk</b><p>Ask your clinic administrator to update integration access. Connection credentials are stored on the clinic server.</p></div><div className="actions"><button type="button" onClick={() => setSettingsOpen(false)}>Done</button></div></section></div>}
  </>;
}
