import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { getClinicTicketsWithConversations, invalidateTicketsCache, replyToFreshdeskTicket } from "@/lib/followups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view clinic communications." }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true") {
      invalidateTicketsCache();
    }
    const updates = await getClinicTicketsWithConversations(50);

    const docName = String(session.doctorName || "").toLowerCase().replace(/^dr\.?\s*/, "").trim();
    const docEmail = String(session.email || "").toLowerCase().trim();

    const filteredUpdates = session.role === "doctor"
      ? updates
          .filter(u => {
            // 1. Exclude outgoing copies sent to the doctor himself
            if (u.tags?.includes("doctor_notification") || u.email.toLowerCase() === docEmail) {
              return false;
            }

            // 2. Doctor relevance: must pertain to this doctor
            const text = `${u.subject} ${u.message} ${(u.tags || []).join(" ")}`.toLowerCase();
            const convMatch = (u.conversations || []).some((c: { from?: string; message?: string }) =>
              (c.from || "").toLowerCase().includes(docName) ||
              (c.message || "").toLowerCase().includes(docName) ||
              (c.from || "").toLowerCase().includes(docEmail)
            );
            const matchesDoctor = (docName && text.includes(docName)) || (docEmail && text.includes(docEmail)) || convMatch;
            if (!matchesDoctor) return false;

            // 3. Must be an actual message from the patient (not an unreplied system notification template)
            const patientReplies = (u.conversations || []).filter((c: { incoming?: boolean; from?: string }) =>
              Boolean(c.incoming) ||
              (c.from &&
                !c.from.toLowerCase().includes("reception") &&
                !c.from.toLowerCase().includes("support@") &&
                !c.from.toLowerCase().includes(docEmail) &&
                !c.from.toLowerCase().includes(docName))
            );

            const isPatientFeedback =
              (u.tags || []).some((t: string) => ["clinic_health_update", "clinic_followup_response", "clinic_appointment_action_request"].includes(t)) ||
              /health change reported|patient follow-up feedback|health check/i.test(u.subject);

            const isSystemTemplate =
              (u.tags || []).includes("patient_notification") ||
              /telehealth consultation confirmed|appointment cancellation notice|new consultation scheduled|consultation cancelled/i.test(u.subject);

            // If it's an unreplied outgoing notification template, it has no message from patient yet
            if (isSystemTemplate && patientReplies.length === 0) {
              return false;
            }

            return true;
          })
          .map(u => {
            // For doctor display: ensure patient message is highlighted
            const patientReplies = (u.conversations || []).filter((c: { incoming?: boolean; from?: string; message?: string }) =>
              Boolean(c.incoming) ||
              (c.from &&
                !c.from.toLowerCase().includes("reception") &&
                !c.from.toLowerCase().includes("support@") &&
                !c.from.toLowerCase().includes(docEmail) &&
                !c.from.toLowerCase().includes(docName))
            );
            if (patientReplies.length > 0) {
              const latest = patientReplies[patientReplies.length - 1];
              return {
                ...u,
                message: latest.message || u.message,
                hasReplies: true,
              };
            }
            return u;
          })
      : updates.filter(u => !u.tags?.includes("doctor_notification") && u.email.toLowerCase() !== docEmail);
    return NextResponse.json({ ok: true, updates: filteredUpdates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load clinic communications.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to dispatch clinic messages." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const ticketId = String(body.ticketId || "").trim();
    const message = String(body.message || "").trim();

    if (!ticketId || !message) {
      return NextResponse.json({ error: "Ticket ID and reply content are required." }, { status: 400 });
    }

    const senderTitle =
      session.role === "doctor" && session.doctorName
        ? session.doctorName
        : `Reception Desk (${session.name || "Receptionist"})`;

    const formattedMessage = `${message}\n\n— Sent by ${senderTitle}`;

    const res = await replyToFreshdeskTicket(ticketId, formattedMessage);
    return NextResponse.json({ ok: true, id: res?.id, message: "Reply successfully delivered via Freshdesk." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch reply.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
