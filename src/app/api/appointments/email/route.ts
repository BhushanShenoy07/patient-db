import { NextResponse } from "next/server";
import { listClinicDoctors, readClinicSession } from "@/lib/auth";
import { createAppointmentActionToken, createFollowupTicket, escapeHtml } from "@/lib/followups";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in before emailing an appointment." }, { status: 401 });
  try {
    const body = await request.json();
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const doctor = typeof body.doctor === "string" ? body.doctor.trim() : "";
    const date = typeof body.date === "string" ? body.date : "";
    const time = typeof body.time === "string" ? body.time : "";
    const mode = body.mode === "Online" ? "Online" : "Offline";
    const doctorAccount = listClinicDoctors().find(item => item.name.toLowerCase() === doctor.toLowerCase());
    if (!appointmentId || !name || !/^\S+@\S+\.\S+$/.test(email) || !doctorAccount?.email || !date || !time || !["Scheduled", "Cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Appointment needs a patient email, a doctor with a configured clinic email account, date, time, and a Scheduled or Cancelled status." }, { status: 400 });
    }
    if (session.role === "doctor" && doctorAccount.name.toLowerCase() !== session.doctorName?.toLowerCase()) {
      return NextResponse.json({ error: "You can only email your own appointments." }, { status: 403 });
    }
    const token = body.status === "Scheduled" ? createAppointmentActionToken({ appointmentId, name, email, doctor, doctorEmail: doctorAccount.email, date, time, mode, zoomId: body.zoomId, zoomUrl: body.zoomUrl }) : "";
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const actionUrl = (action: string) => { const url = new URL("/appointment-response", origin); url.searchParams.set("token", token); url.searchParams.set("action", action); return url.toString(); };
    const safeName = escapeHtml(name);
    const when = `${escapeHtml(date)} at ${escapeHtml(time)}`;
    const zoom = mode === "Online" && typeof body.zoomUrl === "string" && body.zoomUrl ? `<p><a href="${escapeHtml(body.zoomUrl)}">Join your Zoom appointment</a></p>` : "";
    const address = mode === "Offline" ? `<p><strong>Clinic location:</strong> ${process.env.CLINIC_ADDRESS ? escapeHtml(process.env.CLINIC_ADDRESS) : "Please contact the clinic for directions."}</p>` : "";
    const cancelled = body.status === "Cancelled";
    const ticket = await createFollowupTicket({
      email, name, ccEmails: [doctorAccount.email], subject: `Clinic Desk · Appointment ${cancelled ? "cancelled" : date} · ${name}`,
      tags: [cancelled ? "clinic_appointment_cancelled" : "clinic_appointment", `appointment_${appointmentId}`],
      description: cancelled ? `<p>Hello ${safeName},</p><p>Your appointment with ${escapeHtml(doctor)} on ${when} has been cancelled.</p><p>Contact the Clinic Desk if you would like to schedule another visit.</p>` : `<p>Hello ${safeName},</p><p>Your appointment with ${escapeHtml(doctor)} is scheduled for ${when} (${mode}).</p>${zoom}${address}<p>Use these links to send the clinic a request:</p><p><a href="${actionUrl("confirm")}">Confirm appointment</a> · <a href="${actionUrl("reschedule")}">Request a reschedule</a> · <a href="${actionUrl("cancel")}">Request cancellation</a></p><p>The clinic team will update its calendar and contact you to confirm any change.</p>`,
    });
    return NextResponse.json({ ok: true, ticketId: ticket.id, doctorEmail: doctorAccount.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send appointment email.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
