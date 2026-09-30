"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

function StarRating({ label, value, onChange, name }: { label: string; value: number; onChange: (rating: number) => void; name: string }) {
  return <fieldset className="rating-field"><legend>{label}</legend><div className="star-rating" role="radiogroup" aria-label={label}>{[1,2,3,4,5].map(star => <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} star${star === 1 ? "" : "s"} for ${name}`} className={star <= value ? "star chosen" : "star"} onClick={() => onChange(star)}>★</button>)}</div><span className="rating-label">{value ? `${value} out of 5 stars` : "Select a rating"}</span></fieldset>;
}

export default function PatientFeedbackPage() {
  const [token, setToken] = useState("");
  const [doctorRating, setDoctorRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [healthChanged, setHealthChanged] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/follow-up/response", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, doctorRating, serviceRating, healthChanged, message }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "We could not submit your update.");
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "We could not submit your update."); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card feedback-card"><div className="login-brand"><span className="brand-mark clinic-logo-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3h10v8h8v10h-8v8H11v-8H3V11h8z" fill="currentColor"/></svg></span><span><b>Clinic Desk</b><small>Patient care follow-up</small></span></div>{sent ? <><div className="feedback-success">✓</div><h1>Thank you for checking in</h1><p className="login-intro">Your update has been sent to your care team. A doctor or receptionist will review it.</p></> : <form onSubmit={submit}><div className="eyebrow">7-DAY FOLLOW-UP</div><h1>How are you feeling?</h1><p className="login-intro">Share your feedback with the Clinic Desk care team.</p><StarRating label="Rate your doctor" name="your doctor" value={doctorRating} onChange={setDoctorRating} /><StarRating label="Rate the clinic service" name="the clinic service" value={serviceRating} onChange={setServiceRating} /><label className="health-toggle"><input type="checkbox" checked={healthChanged} onChange={e => setHealthChanged(e.target.checked)} /><span>My health has changed since I left the hospital</span></label><label>Anything you would like your care team to know?<textarea rows={5} maxLength={3000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Share how you are feeling or describe any changes…" /></label><p className="feedback-note">If you need urgent medical help, contact your doctor or local emergency services. This form is not monitored for emergencies.</p>{error && <p className="login-error" role="alert">{error}</p>}<button className="login-submit" disabled={busy || !token || !doctorRating || !serviceRating || (healthChanged && !message.trim())}>{busy ? "Sending…" : "Send to my care team"}</button></form>}</section></main>;
}
