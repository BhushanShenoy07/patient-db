import { NextResponse } from "next/server";
import { createFollowupTicket, escapeHtml, readFollowupToken } from "@/lib/followups";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patient = typeof body.token === "string" ? readFollowupToken(body.token) : null;
    const doctorRating = Number(body.doctorRating);
    const serviceRating = Number(body.serviceRating);
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 3000) : "";
    const healthChanged = body.healthChanged === true;
    if (!patient) return NextResponse.json({ error: "This follow-up link is invalid or has expired." }, { status: 410 });
    if (![doctorRating, serviceRating].every(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Rate both your doctor and the clinic service from 1 to 5 stars." }, { status: 400 });
    if (healthChanged && !message) return NextResponse.json({ error: "Please describe the health change so the care team can respond." }, { status: 400 });
    const urgency = healthChanged ? "HEALTH CHANGE REPORTED" : "Patient follow-up feedback";
    const ticket = await createFollowupTicket({
      email: patient.email,
      name: patient.name,
      subject: `Clinic Desk · ${urgency} · ${patient.name}`,
      tags: ["clinic_health_update", "clinic_followup_response", `appointment_${patient.appointmentId}`],
      priority: healthChanged ? 4 : 1,
      description: `<p><strong>Patient:</strong> ${escapeHtml(patient.name)}</p><p><strong>Doctor:</strong> ${escapeHtml(patient.doctor)}</p><p><strong>Doctor rating:</strong> ${doctorRating}/5 stars</p><p><strong>Clinic service rating:</strong> ${serviceRating}/5 stars</p><p><strong>Health change reported:</strong> ${healthChanged ? "Yes" : "No"}</p><p><strong>Patient update:</strong></p><p>${message ? escapeHtml(message).replace(/\n/g, "<br>") : "No additional message."}</p><p><strong>Appointment:</strong> ${escapeHtml(patient.appointmentId)}</p>`,
    });
    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit your follow-up.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
