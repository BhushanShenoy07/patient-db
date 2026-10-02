import { NextResponse } from "next/server";
import { readClinicSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = readClinicSession(request);
  return NextResponse.json({
    user: user
      ? {
          email: user.email,
          name: user.name,
          role: user.role,
          doctorName: user.doctorName,
          specialization: user.specialization,
          artUsername: user.artUsername,
        }
      : null,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
