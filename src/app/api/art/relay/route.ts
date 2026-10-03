import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";

export const runtime = "nodejs";

type RelayMessage = {
  id: string;
  event: string;
  from: string;
  to?: string;
  content: Record<string, unknown>;
  timestamp: number;
};

// In-memory message bus and active heartbeats
const messageQueue: RelayMessage[] = [];
const userHeartbeats = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const from = String(body.from || "").trim().toLowerCase();
    const to = body.to ? String(body.to).trim().toLowerCase() : undefined;
    const event = String(body.event || "clinic_chat");
    const content = body.content || {};
    const id = String(content.id || body.id || crypto.randomUUID());

    if (from) {
      if (body.type === "offline") {
        userHeartbeats.delete(from);
      } else {
        userHeartbeats.set(from, Date.now());
      }
    }

    if (event !== "clinic_presence" || body.type === "announce") {
      const msg: RelayMessage = {
        id,
        event,
        from,
        to,
        content: { ...content, from, to, id },
        timestamp: Date.now(),
      };
      messageQueue.push(msg);
      if (messageQueue.length > 500) {
        messageQueue.splice(0, messageQueue.length - 300);
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: "Relay failed" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username")?.trim().toLowerCase();
  const since = Number(url.searchParams.get("since") || "0");
  const now = Date.now();

  if (username) {
    userHeartbeats.set(username, now);
  }

  // Prune heartbeats older than 30s
  for (const [u, ts] of userHeartbeats.entries()) {
    if (now - ts > 30_000) {
      userHeartbeats.delete(u);
    }
  }

  // Filter messages for this user (targeted to them or broadcast)
  const messages = messageQueue.filter(m => {
    if (m.timestamp <= since) return false;
    if (!m.to) return true; // broadcast
    return m.to === username || m.from === username;
  });

  return NextResponse.json({
    messages,
    activeUsers: Array.from(userHeartbeats.keys()),
    timestamp: now,
  });
}
