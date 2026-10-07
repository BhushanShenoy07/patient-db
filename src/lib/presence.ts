// Shared real-time presence manager across all API routes in Next.js

declare global {
  var __clinicPresenceMap: Map<string, number> | undefined;
}

// 5 minutes grace period:
// Even if doctor or receptionist leaves the site, switches tabs, or minimizes
// the window for 5 seconds (or up to 5 minutes), they REMAIN ONLINE.
const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;

export function getPresenceMap(): Map<string, number> {
  if (!globalThis.__clinicPresenceMap) {
    globalThis.__clinicPresenceMap = new Map<string, number>();
  }
  return globalThis.__clinicPresenceMap;
}

/** Record a fresh heartbeat timestamp for a username */
export function recordHeartbeat(username: string): void {
  const norm = String(username || "").trim().toLowerCase();
  if (!norm) return;
  getPresenceMap().set(norm, Date.now());
}

/** Explicitly mark user offline (e.g., when they sign out) */
export function removeHeartbeat(username: string): void {
  const norm = String(username || "").trim().toLowerCase();
  if (!norm) return;
  getPresenceMap().delete(norm);
}

/** Returns all usernames currently considered online */
export function getActiveUsernames(): string[] {
  const map = getPresenceMap();
  const now = Date.now();
  const active: string[] = [];

  for (const [u, lastSeen] of map.entries()) {
    if (now - lastSeen <= PRESENCE_TIMEOUT_MS) {
      active.push(u);
    } else {
      map.delete(u);
    }
  }
  return active;
}

/** Check if a specific username is currently online */
export function isUserOnline(username: string): boolean {
  const norm = String(username || "").trim().toLowerCase();
  if (!norm) return false;
  const map = getPresenceMap();
  const lastSeen = map.get(norm);
  if (!lastSeen) return false;
  if (Date.now() - lastSeen <= PRESENCE_TIMEOUT_MS) {
    return true;
  }
  map.delete(norm);
  return false;
}
