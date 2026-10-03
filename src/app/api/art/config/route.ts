import { NextResponse } from "next/server";
import { loadClinicAccounts, readClinicSession, type ClinicProfile } from "@/lib/auth";
import { artBrowserConfig } from "@/lib/art";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to connect to ART." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const requestedUsername = url.searchParams.get("username")?.trim().toLowerCase();
    let profile: ClinicProfile = session;
    if (requestedUsername && requestedUsername !== session.artUsername) {
      const match = loadClinicAccounts().find(a => a.artUsername.toLowerCase() === requestedUsername);
      if (match) profile = match;
    }
    return NextResponse.json(artBrowserConfig(profile));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ART is not configured." },
      { status: 503 }
    );
  }
}
