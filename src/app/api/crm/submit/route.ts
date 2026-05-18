import { NextResponse } from "next/server";
import { getCrmForwarder } from "@/lib/server/crm-forwarders";
import { mirrorLeadToInternalCrm } from "@/lib/server/crm-mirror-lead";
import { loadClientCrmIntegration } from "@/lib/server/load-client-crm-integration";
import {
  checkRateLimit,
  corsHeaders,
  isOriginAllowed,
  parseLeadBody,
  verifyTurnstile,
} from "@/lib/server/crm-submit-utils";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

async function handleOptions(request: Request, slug: string | null) {
  const integration = slug ? await loadClientCrmIntegration(slug) : null;
  const headers = integration
    ? corsHeaders(request.headers.get("origin"), integration)
    : {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Client-Slug, X-Ingest-Secret",
      };
  return new NextResponse(null, { status: 204, headers });
}

export async function OPTIONS(request: Request) {
  const slug = request.headers.get("x-client-slug")?.trim() ?? null;
  return handleOptions(request, slug);
}

export async function POST(request: Request) {
  const clientSlug = request.headers.get("x-client-slug")?.trim().toLowerCase() ?? "";
  const ingestSecret = request.headers.get("x-ingest-secret")?.trim() ?? "";
  const origin = request.headers.get("origin");

  if (!clientSlug) {
    return NextResponse.json({ ok: false, error: "Missing X-Client-Slug header." }, { status: 400 });
  }

  const integration = await loadClientCrmIntegration(clientSlug);
  if (!integration) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }

  const cors = corsHeaders(origin, integration);

  if (!integration.enabled) {
    return NextResponse.json({ ok: false, error: "CRM ingest is disabled for this client." }, {
      status: 403,
      headers: cors,
    });
  }

  const expectedSecret = integration.ingestSecret.trim();
  if (!expectedSecret || ingestSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Invalid ingest secret." }, { status: 401, headers: cors });
  }

  if (!isOriginAllowed(origin, integration)) {
    return NextResponse.json({ ok: false, error: "Origin not allowed." }, { status: 403, headers: cors });
  }

  const ip = clientIp(request);
  if (!checkRateLimit(`${clientSlug}:${ip}`)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again later." }, {
      status: 429,
      headers: cors,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  const turnstileToken =
    body && typeof body === "object" && "turnstileToken" in body
      ? String((body as Record<string, unknown>).turnstileToken ?? "")
      : null;

  const turnstileOk = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ ok: false, error: "Captcha verification failed." }, { status: 403, headers: cors });
  }

  const parsed = parseLeadBody(body);
  if (!parsed.payload) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Invalid payload." }, {
      status: 400,
      headers: cors,
    });
  }

  const receivedAt = new Date().toISOString();
  const forwarder = getCrmForwarder(integration.provider);
  const result = await forwarder(parsed.payload, {
    clientSlug,
    origin,
    receivedAt,
    integration,
  });

  if (!result.ok) {
    console.error(`[crm-submit] slug=${clientSlug} provider=${integration.provider} error=${result.error}`);
    return NextResponse.json({ ok: false, error: result.error ?? "Forward failed." }, {
      status: 502,
      headers: cors,
    });
  }

  if (integration.provider !== "nexa" && integration.mirrorToInternalCrm) {
    await mirrorLeadToInternalCrm({
      clientSlug,
      payload: parsed.payload,
      externalId: result.externalId,
    });
  }

  console.log(`[crm-submit] slug=${clientSlug} provider=${integration.provider} ok externalId=${result.externalId ?? "—"}`);

  return NextResponse.json({ ok: true, externalId: result.externalId ?? null }, { status: 201, headers: cors });
}
