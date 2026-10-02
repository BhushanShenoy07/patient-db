import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { artBrowserConfig } from "@/lib/art";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to connect to ART." }, { status: 401 });
  try {
    return NextResponse.json(artBrowserConfig(session));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ART is not configured." },
      { status: 503 }
    );
  }
}
