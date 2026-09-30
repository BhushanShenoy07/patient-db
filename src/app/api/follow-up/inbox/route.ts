import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { searchFollowupTickets } from "@/lib/followups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view patient updates." }, { status: 401 });
  try {
    const result = await searchFollowupTickets("clinic_health_update");
    const tickets = Array.isArray(result.results) ? result.results : [];
    const updates = tickets.map((ticket: any) => ({
      id: String(ticket.id), subject: String(ticket.subject || "Patient health update"),
      email: String(ticket.email || ""), name: String(ticket.name || "Patient"),
      message: String(ticket.description_text || ticket.description || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      createdAt: String(ticket.created_at || ""), priority: Number(ticket.priority || 1),
    }));
    return NextResponse.json({ updates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load patient updates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
