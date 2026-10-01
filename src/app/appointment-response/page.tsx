"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

function IconCheck({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function IconCalendar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M16 2v4M4 2v4M3 8h14" strokeLinecap="round" />
    </svg>
  );
}

function IconCross({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
    </svg>
  );
}

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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/appointment-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, date, time }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to update your appointment request.");
      }
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update your appointment request.");
    } finally {
      setBusy(false);
    }
  }

  const times = Array.from({ length: 18 }, (_, i) => {
    const hour = String(9 + Math.floor(i / 2)).padStart(2, "0");
    const minute = i % 2 ? "30" : "00";
    return `${hour}:${minute}`;
  });

  const getActionBadge = () => {
    if (action === "cancel") {
      return <span className="status-badge badge-rose">Cancellation Request</span>;
    }
    if (action === "reschedule") {
      return <span className="status-badge badge-blue">Reschedule Request</span>;
    }
    return <span className="status-badge badge-emerald">Confirmation Request</span>;
  };

  const getTitle = () => {
    if (action === "cancel") return "Request Appointment Cancellation";
    if (action === "reschedule") return "Request Reschedule";
    return "Confirm Your Appointment";
  };

  const getDescription = () => {
    if (action === "cancel") {
      return "Submit a cancellation request to your doctor and the clinic desk. A staff member will confirm your cancellation.";
    }
    if (action === "reschedule") {
      return "Select your preferred date and time slot. Our clinic administration will verify doctor availability and confirm.";
    }
    return "Confirm your attendance for your scheduled consultation. Your care team has been notified.";
  };

  return (
    <main className="auth-container-shell">
      <section className="portal-card">
        <header className="portal-header">
          <div className="brand-section">
            <div className="brand-icon-box">
              <IconCross className="w-4 h-4" />
            </div>
            <div>
              <div className="brand-title">Clinic Desk</div>
              <div className="brand-subtitle">Patient Care Services</div>
            </div>
          </div>
          <div className="portal-badge-area">
            {getActionBadge()}
          </div>
        </header>

        {complete ? (
          <div className="portal-success-view">
            <div className="success-icon-circle">
              <IconCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="portal-heading">Request Received</h1>
            <p className="portal-subtext">
              Thank you. Your appointment response has been recorded. Our reception and clinical team have been notified and will process this in the clinic schedule.
            </p>
            <div className="portal-info-box">
              <div className="portal-info-title">Need immediate assistance?</div>
              <p className="portal-info-body">
                For urgent clinical matters or same-day concerns, please call the clinic directly at +91 (080) 4567-8900.
              </p>
            </div>
            <div className="portal-actions">
              <Link href="/" className="btn-secondary text-center">
                Return to Clinic Portal
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="portal-form">
            <div className="form-intro-block">
              <h1 className="portal-heading">{getTitle()}</h1>
              <p className="portal-subtext">{getDescription()}</p>
            </div>

            {action === "reschedule" && (
              <div className="portal-fields-grid">
                <div className="input-group">
                  <label htmlFor="preferred-date" className="input-label">
                    <IconCalendar className="w-3.5 h-3.5 text-slate-500 inline mr-1.5" />
                    Preferred New Date
                  </label>
                  <input
                    id="preferred-date"
                    type="date"
                    min={date}
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="portal-input"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="preferred-time" className="input-label">
                    Preferred Time Slot
                  </label>
                  <select
                    id="preferred-time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="portal-input"
                  >
                    {times.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} IST
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="alert-box alert-error" role="alert">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {!token && (
              <div className="alert-box alert-amber" role="alert">
                <span className="font-semibold">Notice:</span> No security verification token found in URL. Please use the direct link provided in your clinic notification email.
              </div>
            )}

            <div className="portal-form-buttons">
              <button
                type="submit"
                className={`btn-primary w-full ${action === "cancel" ? "btn-danger" : ""}`}
                disabled={busy || !token}
              >
                {busy
                  ? "Processing..."
                  : action === "cancel"
                  ? "Confirm Cancellation Request"
                  : action === "reschedule"
                  ? "Submit Reschedule Request"
                  : "Confirm Appointment"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
