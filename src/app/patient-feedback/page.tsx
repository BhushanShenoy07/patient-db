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

function IconStar({ filled, className = "w-5 h-5" }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={`${className} ${filled ? "text-amber-500 fill-amber-400" : "text-slate-300 fill-transparent"}`}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? "1" : "1.5"}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
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

function IconAlertTriangle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 18.75h.007v.008H12v-.008z" />
    </svg>
  );
}

const RATING_LABELS = ["", "1 - Needs Improvement", "2 - Fair", "3 - Satisfactory", "4 - Very Good", "5 - Excellent"];

function StarRating({
  label,
  value,
  onChange,
  name,
}: {
  label: string;
  value: number;
  onChange: (rating: number) => void;
  name: string;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <fieldset className="rating-fieldset">
      <div className="flex items-center justify-between mb-1.5">
        <legend className="rating-legend font-medium text-slate-800 text-xs tracking-wide uppercase">
          {label}
        </legend>
        <span className="text-xs font-semibold text-teal-700">
          {RATING_LABELS[hovered || value] || "Select rating"}
        </span>
      </div>
      <div
        className="rating-stars-row"
        role="radiogroup"
        aria-label={label}
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = (hovered || value) >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star === 1 ? "" : "s"} for ${name}`}
              className="rating-star-btn"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
            >
              <IconStar filled={isFilled} className="w-6 h-6 transition-transform hover:scale-110" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
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

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/follow-up/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          doctorRating,
          serviceRating,
          healthChanged,
          message,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to submit your feedback update.");
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit your feedback update.");
    } finally {
      setBusy(false);
    }
  }

  const isFormValid =
    token &&
    doctorRating > 0 &&
    serviceRating > 0 &&
    (!healthChanged || message.trim().length > 0);

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
              <div className="brand-subtitle">Post-Care Patient Follow-up</div>
            </div>
          </div>
          <div className="portal-badge-area">
            <span className="status-badge badge-blue">Care Continuity</span>
          </div>
        </header>

        {sent ? (
          <div className="portal-success-view">
            <div className="success-icon-circle">
              <IconCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="portal-heading">Thank You for Checking In</h1>
            <p className="portal-subtext">
              Your recovery and clinical feedback have been securely recorded. Your assigned doctor and nursing team have been notified.
            </p>
            {healthChanged && (
              <div className="portal-info-box alert-amber">
                <div className="portal-info-title font-semibold text-amber-900">Follow-up Priority Assigned</div>
                <p className="portal-info-body text-amber-800">
                  Because you indicated a change in your health, a member of our medical team will review your notes and contact you within 24 hours.
                </p>
              </div>
            )}
            <div className="portal-actions">
              <Link href="/" className="btn-secondary text-center">
                Return to Clinic Portal
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="portal-form">
            <div className="form-intro-block">
              <div className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">
                Post-Consultation Health Check
              </div>
              <h1 className="portal-heading">How Is Your Recovery?</h1>
              <p className="portal-subtext">
                Your feedback helps our clinical staff monitor your treatment progress and maintain high standards of patient care.
              </p>
            </div>

            <div className="space-y-4">
              <StarRating
                label="Doctor Consultation & Care"
                name="doctor care"
                value={doctorRating}
                onChange={setDoctorRating}
              />

              <StarRating
                label="Clinic Service & Facilities"
                name="clinic service"
                value={serviceRating}
                onChange={setServiceRating}
              />
            </div>

            <div className="health-change-card mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={healthChanged}
                  onChange={(e) => setHealthChanged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800">
                    My health or symptoms have changed since my appointment
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Check this if you are experiencing new symptoms, unexpected reactions to medications, or need care team review.
                  </span>
                </div>
              </label>
            </div>

            <div className="input-group mt-3">
              <label htmlFor="patient-message" className="input-label">
                Additional Notes or Observations for Your Care Team
                {healthChanged && <span className="text-rose-600 font-semibold ml-1">* Required</span>}
              </label>
              <textarea
                id="patient-message"
                rows={4}
                maxLength={3000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  healthChanged
                    ? "Please describe the changes in your symptoms or recovery..."
                    : "Optional comments regarding your recovery or appointment experience..."
                }
                className="portal-input"
              />
            </div>

            <div className="emergency-disclaimer flex items-start gap-2 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <IconAlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Important Notice:</strong> This feedback form is for routine follow-up monitoring and is not continuously monitored for emergencies. If you are experiencing acute chest pain, shortness of breath, or medical emergencies, please immediately visit the nearest emergency room or dial emergency services.
              </span>
            </div>

            {error && (
              <div className="alert-box alert-error" role="alert">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {!token && (
              <div className="alert-box alert-amber" role="alert">
                <span className="font-semibold">Notice:</span> Feedback link missing validation token. Please access this page using the link sent to your registered email.
              </div>
            )}

            <div className="portal-form-buttons">
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !isFormValid}
              >
                {busy ? "Submitting Care Update..." : "Submit Health Update to Care Team"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
