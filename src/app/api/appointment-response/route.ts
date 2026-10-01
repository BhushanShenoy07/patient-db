import { NextResponse } from "next/server";
import { createFollowupTicket, escapeHtml, readAppointmentActionToken } from "@/lib/followups";
import { saveAirtableRecord } from "@/lib/airtable";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? readAppointmentActionToken(body.token) : null;
    const action = body.action;
    if (!token) return NextResponse.json({ error: "This appointment link is invalid or has expired." }, { status: 410 });
    if (!["confirm", "cancel", "reschedule"].includes(action)) return NextResponse.json({ error: "Choose confirm, cancel, or reschedule." }, { status: 400 });

    let requestedTime = "";
    if (action === "reschedule") {
      const date = typeof body.date === "string" ? body.date : "";
      const time = typeof body.time === "string" ? body.time : "";
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
      const minutes = match ? Number(match[1]) * 60 + Number(match[2]) : -1;
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
      const requestedAt = new Date(`${date}T${time}:00`).getTime();
      if (!validDate || Number.isNaN(requestedAt) || requestedAt <= Date.now() || minutes < 540 || minutes >= 1080 || minutes % 30 !== 0) {
        return NextResponse.json({ error: "Choose a future date and a half-hour slot between 9:00 AM and 6:00 PM." }, { status: 400 });
      }
      requestedTime = `${date} at ${time}`;
    }

    const requestLabel = action === "confirm" ? "confirmation" : action === "cancel" ? "cancellation" : `reschedule to ${requestedTime}`;
    const ticket = await createFollowupTicket({
      email: token.email,
      name: token.name,
      ccEmails: [token.doctorEmail],
      subject: `Clinic Desk · Patient ${requestLabel} request · ${token.name}`,
      tags: ["clinic_appointment_action_request", `appointment_${token.appointmentId}`],
      priority: 2,
      description: `<p>${escapeHtml(token.name)} submitted an appointment ${escapeHtml(requestLabel)} request.</p><p><strong>Current appointment:</strong> ${escapeHtml(token.date)} at ${escapeHtml(token.time)} with ${escapeHtml(token.doctor)}.</p>${requestedTime ? `<p><strong>Requested new time:</strong> ${escapeHtml(requestedTime)}.</p>` : ""}<p>This request has been sent to the clinic team. The clinic will update its calendar and contact the patient to confirm.</p>`,
    });

    if (token.appointmentId) {
      if (action === "confirm") {
        await saveAirtableRecord(token.appointmentId, { Status: "Confirmed" }).catch(e => console.warn("Airtable sync status warning:", e));
      } else if (action === "cancel") {
        await saveAirtableRecord(token.appointmentId, { Status: "Cancelled" }).catch(e => console.warn("Airtable sync status warning:", e));
      }
    }

    return NextResponse.json({ ok: true, action, ticketId: ticket.id, requestSubmitted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit this appointment request.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
