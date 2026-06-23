import type { ClientCrmIntegration } from "@/types";
import type { NormalizedLeadPayload } from "@/lib/server/crm-forwarders/types";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const MAX_FIELD = 500;
const MAX_MESSAGE = 4000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

export function normalizeOrigin(origin: string | null): string | null {
  if (!origin?.trim()) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(origin: string | null, integration: ClientCrmIntegration): boolean {
  const allowed = integration.allowedOrigins.map((o) => normalizeOrigin(o) ?? o.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const reqOrigin = normalizeOrigin(origin);
  if (!reqOrigin) return false;
  return allowed.some((a) => {
    const norm = normalizeOrigin(a) ?? a;
    return norm === reqOrigin;
  });
}

export function corsHeaders(origin: string | null, integration: ClientCrmIntegration): HeadersInit {
  const reqOrigin = normalizeOrigin(origin);
  const allowed = integration.allowedOrigins.map((o) => normalizeOrigin(o) ?? o.trim()).filter(Boolean);
  let allowOrigin = "*";
  if (allowed.length > 0 && reqOrigin && allowed.some((a) => (normalizeOrigin(a) ?? a) === reqOrigin)) {
    allowOrigin = reqOrigin;
  } else if (allowed.length === 0) {
    allowOrigin = reqOrigin ?? "*";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Client-Slug, X-Ingest-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function parseLeadBody(raw: unknown): { payload: NormalizedLeadPayload | null; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { payload: null, error: "Invalid JSON body." };
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.website === "string" && o.website.trim() !== "") {
    return { payload: null, error: "Rejected." };
  }

  const name = clip(String(o.name ?? "").trim(), MAX_FIELD);
  const email = clip(String(o.email ?? "").trim(), MAX_FIELD);
  if (!name) return { payload: null, error: "Name is required." };
  if (!email || !email.includes("@")) return { payload: null, error: "Valid email is required." };

  let custom: Record<string, unknown> = {};
  if (o.custom && typeof o.custom === "object" && !Array.isArray(o.custom)) {
    custom = o.custom as Record<string, unknown>;
  }

  const funnelRaw = clip(String(o.funnel ?? "").trim(), MAX_FIELD);

  return {
    payload: {
      name,
      email,
      phone: clip(String(o.phone ?? "").trim(), MAX_FIELD),
      company: clip(String(o.company ?? "").trim(), MAX_FIELD),
      message: clip(String(o.message ?? "").trim(), MAX_MESSAGE),
      source: clip(String(o.source ?? "Website").trim(), MAX_FIELD) || "Website",
      funnel: funnelRaw || undefined,
      custom,
    },
  };
}

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token?.trim()) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return json.success === true;
}
