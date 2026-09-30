"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

export default function AppointmentResponsePage() {
  const [token, setToken] = useState("");
  const [action, setAction] = useState("confirm");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setToken(query.get("token") || "");
    setAction(query.get("action") || "confirm");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.getFullYear() + "-" + String(tomorrow.getMonth() + 1).padStart(2, "0") + "-" + String(tomorrow.getDate()).padStart(2, "0"));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/appointment-response", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action, date, time }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "We could not update your appointment.");
      setComplete(true);
    } catch (e) { setError(e instanceof Error ? e.message : "We could not update your appointment."); }
    finally { setBusy(false); }
  }
  const times = Array.from({ length: 18 }, (_, i) => String(9 + Math.floor(i / 2)).padStart(2, "0") + ":" + (i % 2 ? "30" : "00"));
  const title = action === "cancel" ? "Cancel this appointment?" : action === "reschedule" ? "Choose a new appointment time" : "Confirm your appointment";
  return <main className="login-shell"><section className="login-card feedback-card"><div className="login-brand"><span className="brand-mark clinic-logo-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" fill="currentColor" /></svg></span><span><b>Clinic Desk</b><small>Appointment services</small></span></div>{complete ? <><div className="feedback-success">✓</div><h1>Request received</h1><p className="login-intro">The clinic team has been notified. They will update the calendar and contact you to confirm your appointment request.</p></> : <form onSubmit={submit}><div className="eyebrow">APPOINTMENT RESPONSE</div><h1>{title}</h1><p className="login-intro">{action === "reschedule" ? "Choose your preferred new date and time. The clinic will check availability and contact you to confirm." : action === "cancel" ? "Send a cancellation request to your doctor and the clinic. The clinic will contact you to confirm." : "Send a confirmation request to your doctor and the clinic."}</p>{action === "reschedule" && <><label>Preferred new date<input type="date" min={date} required value={date} onChange={e => setDate(e.target.value)} /></label><label>Preferred time<select value={time} onChange={e => setTime(e.target.value)}>{times.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></label></>}{error && <p className="login-error" role="alert">{error}</p>}<button className="login-submit" disabled={busy || !token}>{busy ? "Sending request…" : action === "cancel" ? "Send cancellation request" : action === "reschedule" ? "Send reschedule request" : "Send confirmation request"}</button></form>}</section></main>;
}
