import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { getClinicTicketsWithConversations, replyToFreshdeskTicket } from "@/lib/followups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view clinic communications." }, { status: 401 });
  try {
    const updates = await getClinicTicketsWithConversations(30);
    return NextResponse.json({ ok: true, updates });
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
