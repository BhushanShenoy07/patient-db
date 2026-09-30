import { NextResponse } from "next/server";
import { listClinicDoctors, readClinicSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!readClinicSession(request)) return NextResponse.json({ error: "Sign in to view clinic doctors." }, { status: 401 });
  try { return NextResponse.json({ doctors: listClinicDoctors() }); }
  catch { return NextResponse.json({ error: "Configure doctor accounts in CLINIC_USERS_JSON." }, { status: 503 }); }
}
