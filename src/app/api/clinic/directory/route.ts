import { NextResponse } from "next/server";
import { listClinicDirectory, loadClinicAccounts, readClinicSession } from "@/lib/auth";
import { recordHeartbeat, getActiveUsernames } from "@/lib/presence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view the clinic directory." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const requestedUsername = url.searchParams.get("username")?.trim().toLowerCase();
    const currentUser = (requestedUsername && loadClinicAccounts().find(a => a.artUsername.toLowerCase() === requestedUsername)) || session;

    if (currentUser.artUsername) {
      recordHeartbeat(currentUser.artUsername);
    }
    if (session.artUsername) {
      recordHeartbeat(session.artUsername);
    }

    return NextResponse.json({
      people: listClinicDirectory(currentUser),
      activeUsernames: getActiveUsernames(),
    });
  } catch {
    return NextResponse.json({ error: "Configure clinic accounts in CLINIC_USERS_JSON." }, { status: 503 });
  }
}
