import Adk from "@arealtimetech/adk-js";

export type ArtBrowserConfig = {
  uri: string;
  org: string;
  environment: string;
  projectKey: string;
  channel: string;
  event: string;
  username: string;
};

type Subscription = Awaited<ReturnType<InstanceType<typeof Adk>["subscribe"]>> & Record<string, any>;
export type ArtConnection = { adk: InstanceType<typeof Adk>; sub: Subscription; config: ArtBrowserConfig };

/*
 * Browser-side ART connection for the signed-in user.
 *
 * The ADK keeps one socket and one auth state per JavaScript runtime, so each
 * user connects from their own browser as themselves. The ADK's token request
 * is sent to /api/art/token, where the server issues a token for the session's
 * own profile, so the client secret never reaches the browser and nobody can
 * connect as another user.
 */

let connection: Promise<ArtConnection> | null = null;
let online = new Set<string>();
let presenceSupported = false;
let presenceWaiters: (() => void)[] = [];
type ArtListener = (message: { event: string; content: Record<string, unknown> }) => void;
// One SDK listener per connection fans out to the page; ids drop repeat deliveries.
const listeners = new Set<ArtListener>();
const seenIds = new Set<string>();
const presenceListeners = new Set<(online: Set<string>) => void>();
let presenceTimer: ReturnType<typeof setInterval> | undefined;
// Without channel presence, reachability is probed with an acknowledged ping.
const PING_EVENT = "clinic_ping";
let watched: string[] = [];
let pingTimer: ReturnType<typeof setInterval> | undefined;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function routeTokenRequestsThroughServer(uri: string) {
  const tokenUrl = `https://${uri}/auth/token`;
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __artTokenRoute?: string };
  if (w.__artTokenRoute === tokenUrl) return;
  w.__artTokenRoute = tokenUrl;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url === tokenUrl) {
      return originalFetch("/api/art/token", { method: "POST", credentials: "same-origin" });
    }
    return originalFetch(input, init);
  };
}

async function open(): Promise<ArtConnection> {
  const response = await fetch("/api/art/config");
  const config = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(config.error || `ART configuration unavailable (${response.status}).`);
  routeTokenRequestsThroughServer(config.uri);

  const adk = new Adk({ Uri: config.uri });
  // The ADK requires these fields to be present; the real values are applied on the server.
  adk.setCredentials({
    ClientID: "server-managed",
    ClientSecret: "server-managed",
    OrgTitle: config.org,
    Environment: config.environment,
    ProjectKey: config.projectKey,
  });

  const opened = new Promise<void>(resolve => adk.on("open", () => resolve()));
  adk.connect();
  await withTimeout(opened, 20_000, "Connecting to ART");

  const sub = (await withTimeout(adk.subscribe(config.channel), 20_000, "Subscribing to the ART channel")) as Subscription;
  // On a secure channel, senders encrypt to this browser's public key.
  if (sub.channelConfig?.channelType === "secure") {
    await adk.setKeyPair(await adk.generateKeyPair());
  }

  // Presence must be enabled on the channel in the ART console. Without it, the
  // delivery acknowledgement from push() is the only signal that a user is online.
  try {
    await sub.fetchPresence((usernames: string[]) => {
      online = new Set(usernames.map(name => name.split(":")[0].toLowerCase()));
      presenceWaiters.splice(0).forEach(resolve => resolve());
      presenceListeners.forEach(listener => listener(new Set(online)));
    });
    presenceSupported = true;
    // ART also pushes joins and leaves; the periodic request is a safety net.
    presenceTimer = setInterval(() => {
      sub.push("art_presence", {}).catch(() => {});
    }, 20_000);
  } catch (error) {
    presenceSupported = false;
    console.warn(`[ART] Presence is not enabled on "${config.channel}"; relying on delivery acknowledgements.`, error);
  }

  sub.listen((message: { event: string; content: Record<string, unknown> }) => {
    if (message?.event === PING_EVENT) return; // reachability probe, not a message
    const id = typeof message?.content?.id === "string" ? message.content.id : "";
    if (id) {
      if (seenIds.has(id)) return;
      seenIds.add(id);
    }
    listeners.forEach(listener => listener(message));
  });

  return { adk, sub, config };
}

/** Opens (once) and returns the signed-in user's ART connection. */
export function connectArt() {
  connection ??= open().catch(error => {
    connection = null;
    throw error;
  });
  return connection;
}

export async function disconnectArt() {
  const current = connection;
  connection = null;
  online = new Set();
  presenceSupported = false;
  clearInterval(presenceTimer);
  clearInterval(pingTimer);
  pingTimer = undefined;
  const conn = await current?.catch(() => null);
  await conn?.adk.disconnect();
}

async function refreshPresence(sub: Subscription) {
  const updated = new Promise<void>(resolve => presenceWaiters.push(resolve));
  // Not awaited: ART answers through the presence listener, not with an ack (the ADK does the same).
  sub.push("art_presence", {}).catch(() => {});
  await withTimeout(updated, 5_000, "Checking who is online");
}

export type SendResult = { delivered: true } | { delivered: false; reason: string };

/**
 * Sends an event to exactly one user. When the channel has presence, offline
 * users are skipped up front. Either way, delivery is confirmed by ART's
 * acknowledgement: push() only resolves once ART accepts the message for a
 * connected recipient, and ART drops targeted events for users who are offline.
 */
export async function sendToUser(
  username: string,
  payload: Record<string, unknown>,
  event?: string
): Promise<SendResult> {
  if (typeof payload.id !== "string") payload = { ...payload, id: crypto.randomUUID() };
  const { sub, config } = await connectArt();
  const recipient = username.toLowerCase();
  if (recipient === config.username.toLowerCase()) {
    throw new Error("You cannot send an ART message to yourself.");
  }
  if (presenceSupported) {
    await refreshPresence(sub).catch(() => {});
    if (!online.has(recipient)) return { delivered: false, reason: `${recipient} is not online.` };
  }
  try {
    await withTimeout(
      sub.push(event || config.event, payload, { to: [recipient] }),
      15_000,
      "Delivery acknowledgement"
    );
    if (!presenceSupported) markReachable(recipient, true);
    return { delivered: true };
  } catch (error) {
    if (!presenceSupported) markReachable(recipient, false);
    return {
      delivered: false,
      reason:
        error instanceof Error && /timed out/.test(error.message)
          ? `${recipient} did not acknowledge the message, so they are probably not connected.`
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }
}

export async function artStatus() {
  const { config } = await connectArt();
  return { username: config.username, channel: config.channel, presence: presenceSupported };
}

/** Calls handler once for every event delivered to this user. Returns an unsubscribe function. */
export function onArtEvent(handler: ArtListener) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/** Calls handler with the set of online ART usernames whenever presence changes. */
export function onPresence(handler: (online: Set<string>) => void) {
  presenceListeners.add(handler);
  if (presenceSupported) handler(new Set(online));
  return () => {
    presenceListeners.delete(handler);
  };
}

function markReachable(username: string, reachable: boolean) {
  if (reachable) online.add(username);
  else online.delete(username);
  presenceListeners.forEach(listener => listener(new Set(online)));
}

async function probe(username: string) {
  try {
    const { sub, config } = await connectArt();
    await withTimeout(sub.push(PING_EVENT, { from: config.username }, { to: [username] }), 8_000, "Reachability check");
    markReachable(username, true);
  } catch {
    markReachable(username, false);
  }
}

/**
 * Keeps the online status of these users current. Uses the channel's presence
 * when ART has it enabled; otherwise each user is pinged every 30s, and ART only
 * acknowledges the ping when that user is connected.
 */
export async function watchUsers(usernames: string[]) {
  watched = usernames.map(name => name.toLowerCase());
  try {
    const { config } = await connectArt();
    if (presenceSupported) return;
    const checkAll = () => watched.filter(name => name !== config.username.toLowerCase()).forEach(name => void probe(name));
    checkAll();
    clearInterval(pingTimer);
    pingTimer = setInterval(checkAll, 30_000);
  } catch {
    // If not connected yet, ignore
  }
}

/** Re-checks one user now, e.g. when their conversation is opened. */
export function checkUser(username: string) {
  if (!presenceSupported) void probe(username.toLowerCase());
}
