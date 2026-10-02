import { NextResponse } from "next/server";
import { listClinicDirectory, readClinicSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view the clinic directory." }, { status: 401 });
  try {
    return NextResponse.json({ people: listClinicDirectory(session) });
  } catch {
    return NextResponse.json({ error: "Configure clinic accounts in CLINIC_USERS_JSON." }, { status: 503 });
  }
}
