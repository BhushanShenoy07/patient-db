import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { calendarRequest } from "@/lib/google-calendar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!readClinicSession(request)) return NextResponse.json({ error: "Sign in before updating Google Calendar." }, { status: 401 });
  try {
    const body = await request.json();
    const { date, time, duration, name, email, doctor, mode, existingEventId, action } = body || {};
    if (action === "delete") {
      if (typeof existingEventId !== "string" || !existingEventId) return NextResponse.json({ ok: true });
      await calendarRequest("DELETE", existingEventId); return NextResponse.json({ ok: true });
    }
    if (typeof date !== "string" || typeof time !== "string" || typeof name !== "string" || typeof doctor !== "string") return NextResponse.json({ error: "Appointment details are required." }, { status: 400 });
    const start = `${date}T${time.length === 5 ? `${time}:00` : time}`;
    const startDate = new Date(`${start}+05:30`);
    const endDate = new Date(startDate.getTime() + (Number(duration) || 30) * 60_000);
    const event = { summary: `Clinic appointment: ${name} with ${doctor}`, description: `${mode === "Online" ? "Online Zoom appointment" : "In-person clinic appointment"}${email ? `\nPatient: ${email}` : ""}`, start: { dateTime: startDate.toISOString(), timeZone: "Asia/Kolkata" }, end: { dateTime: endDate.toISOString(), timeZone: "Asia/Kolkata" } };
    const saved = await calendarRequest(existingEventId ? "PATCH" : "POST", typeof existingEventId === "string" ? existingEventId : null, event);
    return NextResponse.json({ ok: true, eventId: saved.id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update Google Calendar." }, { status: 502 }); }
}
