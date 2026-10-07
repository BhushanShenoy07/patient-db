import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { recordHeartbeat, getActiveUsernames } from "@/lib/presence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.artUsername) {
    recordHeartbeat(session.artUsername);
  }
  return NextResponse.json({
    ok: true,
    user: session.artUsername,
    activeUsers: getActiveUsernames(),
  });
}

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.artUsername) {
    recordHeartbeat(session.artUsername);
  }
  return NextResponse.json({
    ok: true,
    user: session.artUsername,
    activeUsers: getActiveUsernames(),
  });
}
