import { NextResponse } from "next/server";
import { listClinicDirectory, loadClinicAccounts, readClinicSession } from "@/lib/auth";

export const runtime = "nodejs";

const activeHeartbeats = new Map<string, number>();

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view the clinic directory." }, { status: 401 });
  try {
    const now = Date.now();
    const url = new URL(request.url);
    const requestedUsername = url.searchParams.get("username")?.trim().toLowerCase();
    const currentUser = (requestedUsername && loadClinicAccounts().find(a => a.artUsername.toLowerCase() === requestedUsername)) || session;

    activeHeartbeats.set(currentUser.artUsername.toLowerCase(), now);

    // Prune entries older than 30 seconds
    for (const [username, lastSeen] of activeHeartbeats.entries()) {
      if (now - lastSeen > 30_000) {
        activeHeartbeats.delete(username);
      }
    }

    return NextResponse.json({
      people: listClinicDirectory(currentUser),
      activeUsernames: Array.from(activeHeartbeats.keys()),
    });
  } catch {
    return NextResponse.json({ error: "Configure clinic accounts in CLINIC_USERS_JSON." }, { status: 503 });
  }
}
