import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { clinicSessionMaxAge, createSessionToken, loadClinicAccounts, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function matchesPassword(input: string, configured: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.email !== "string" || typeof body?.password !== "string" || !["doctor", "receptionist"].includes(body?.role)) {
      return NextResponse.json({ error: "Choose a role and enter your email and password." }, { status: 400 });
    }
    const accounts = loadClinicAccounts();
    const email = body.email.trim().toLowerCase();
    const account = accounts.find(user => user.email === email && matchesPassword(body.password, user.password));
    if (!account) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    if (account.role !== body.role) return NextResponse.json({ error: `This account is registered as a ${account.role}. Choose that role to continue.` }, { status: 403 });

    const response = NextResponse.json({
      user: {
        email: account.email,
        name: account.name,
        role: account.role,
        doctorName: account.doctorName,
        specialization: account.specialization,
        artUsername: account.artUsername,
      },
    });
    response.cookies.set(SESSION_COOKIE, createSessionToken(account), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: clinicSessionMaxAge,
    });
    return response;
  } catch (error) {
    console.error("Clinic login configuration error:", error instanceof Error ? error.message : "Invalid account configuration");
    return NextResponse.json({ error: "Clinic login is not configured. Set CLINIC_USERS_JSON and CLINIC_SESSION_SECRET on the server." }, { status: 503 });
  }
}
