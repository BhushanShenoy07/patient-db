import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { calendarRequest } from "@/lib/google-calendar";

export const runtime = "nodejs";

function hasCalendarConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  return Boolean(
    email && email !== "xxx" &&
    rawKey && rawKey !== "xxx" &&
    calendarId && calendarId !== "xxx"
  );
}

export async function POST(request: Request) {
  if (!readClinicSession(request)) return NextResponse.json({ error: "Sign in before updating Google Calendar." }, { status: 401 });
  try {
    const body = await request.json();
    const { date, time, duration, name, email, doctor, mode, existingEventId, action } = body || {};

    if (action === "delete") {
      if (typeof existingEventId !== "string" || !existingEventId || existingEventId.startsWith("cal_")) {
        return NextResponse.json({ ok: true, simulated: true });
      }
      if (hasCalendarConfig()) {
        try {
          await calendarRequest("DELETE", existingEventId);
        } catch (e) {
          console.warn("Google Calendar delete failed (ignoring):", e instanceof Error ? e.message : e);
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (typeof date !== "string" || typeof time !== "string" || typeof name !== "string" || typeof doctor !== "string") {
      return NextResponse.json({ error: "Appointment details are required." }, { status: 400 });
    }

    if (!hasCalendarConfig()) {
      return NextResponse.json({
        ok: true,
        eventId: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        simulated: true,
      });
    }

    try {
      const start = `${date}T${time.length === 5 ? `${time}:00` : time}`;
      const startDate = new Date(`${start}+05:30`);
      const endDate = new Date(startDate.getTime() + (Number(duration) || 30) * 60_000);
      const event = {
        summary: `Clinic appointment: ${name} with ${doctor}`,
        description: `${mode === "Online" ? "Online Zoom appointment" : "In-person clinic appointment"}${email ? `\nPatient: ${email}` : ""}`,
        start: { dateTime: startDate.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: endDate.toISOString(), timeZone: "Asia/Kolkata" },
      };
      const isExistingValid = existingEventId && !existingEventId.startsWith("cal_");
      const saved = await calendarRequest(isExistingValid ? "PATCH" : "POST", isExistingValid ? existingEventId : null, event);
      return NextResponse.json({ ok: true, eventId: saved.id });
    } catch (apiError) {
      console.warn("Google Calendar API call failed; returning resilient simulated event ID:", apiError instanceof Error ? apiError.message : apiError);
      return NextResponse.json({
        ok: true,
        eventId: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        simulated: true,
      });
    }
  } catch (error) {
    return NextResponse.json({
      ok: true,
      eventId: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      simulated: true,
    });
  }
}
