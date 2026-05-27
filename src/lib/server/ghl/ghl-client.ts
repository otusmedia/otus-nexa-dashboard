import { mapGhlContactFromRaw, mapGhlOpportunityFromRaw } from "@/lib/server/ghl/ghl-map";
import type { GhlContact, GhlOpportunity, GhlPipeline } from "@/lib/server/ghl/ghl-types";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

type GhlJson = Record<string, unknown>;

export { mapGhlContactFromRaw as mapGhlContact, mapGhlOpportunityFromRaw as mapGhlOpportunity };

function pickString(obj: GhlJson, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function pickNumber(obj: GhlJson, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function ghlRequest(
  token: string,
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string | undefined> },
): Promise<GhlJson> {
  const url = new URL(`${GHL_BASE}${path}`);
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }
  const { searchParams: _s, ...rest } = init ?? {};
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: GhlJson = {};
  if (text) {
    try {
      body = JSON.parse(text) as GhlJson;
    } catch {
      body = { raw: text };
    }
  }
  if (!res.ok) {
    const msg =
      pickString(body, "message", "error", "msg") ??
      (typeof body.raw === "string" ? body.raw : res.statusText);
    throw new Error(`GHL ${res.status}: ${msg}`);
  }
  return body;
}

function extractArray(body: GhlJson, keys: string[]): GhlJson[] {
  for (const key of keys) {
    const v = body[key];
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as GhlJson[];
  }
  return [];
}

type GhlPageCursor = { startAfterId: string; startAfter?: string };

function extractOpportunityCursor(body: GhlJson): GhlPageCursor | null {
  const meta = body.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as GhlJson;
  const startAfterId = pickString(m, "startAfterId");
  if (!startAfterId) return null;
  const startAfterRaw = m.startAfter;
  const startAfter =
    startAfterRaw != null && String(startAfterRaw).trim() !== ""
      ? String(startAfterRaw).trim()
      : undefined;
  return { startAfterId, startAfter };
}

function extractNextCursor(body: GhlJson): string | null {
  const meta = body.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const m = meta as GhlJson;
    const next = pickString(m, "startAfterId", "nextStartAfterId", "nextPageUrl");
    if (next && !next.startsWith("http")) return next;
    if (next?.includes("startAfterId=")) {
      try {
        const u = new URL(next);
        return u.searchParams.get("startAfterId") ?? null;
      } catch {
        return null;
      }
    }
  }
  return pickString(body, "startAfterId", "nextStartAfterId") ?? null;
}

export async function fetchGhlPipelines(token: string, locationId: string): Promise<GhlPipeline[]> {
  const body = await ghlRequest(token, "/opportunities/pipelines", {
    method: "GET",
    searchParams: { locationId },
  });
  const rows = extractArray(body, ["pipelines", "data"]);
  return rows
    .map((row) => {
      const id = pickString(row, "id");
      if (!id) return null;
      const stageRows = extractArray(row, ["stages", "pipelineStages"]);
      const stages = stageRows
        .map((s) => {
          const sid = pickString(s, "id");
          const name = pickString(s, "name");
          if (!sid || !name) return null;
          return { id: sid, name };
        })
        .filter((s): s is { id: string; name: string } => s != null);
      return { id, name: pickString(row, "name") ?? id, stages };
    })
    .filter((p): p is GhlPipeline => p != null);
}

export async function fetchGhlOpportunities(
  token: string,
  locationId: string,
  pipelineId?: string,
  onProgress?: (msg: string) => void,
): Promise<GhlOpportunity[]> {
  const out: GhlOpportunity[] = [];
  const seen = new Set<string>();
  let cursor: GhlPageCursor | undefined;
  let page = 0;
  const maxPages = 50;

  while (page < maxPages) {
    onProgress?.(`Oportunidades: página ${page + 1}…`);
    const body = await ghlRequest(token, "/opportunities/search", {
      method: "GET",
      searchParams: {
        location_id: locationId,
        pipeline_id: pipelineId,
        limit: "100",
        startAfterId: cursor?.startAfterId,
        startAfter: cursor?.startAfter,
      },
    });
    const rows = extractArray(body, ["opportunities", "data"]);
    let added = 0;
    for (const row of rows) {
      const mapped = mapGhlOpportunityFromRaw(row);
      if (mapped && !seen.has(mapped.id)) {
        seen.add(mapped.id);
        out.push(mapped);
        added += 1;
      }
    }

    const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as GhlJson) : null;
    const total = meta ? pickNumber(meta, "total") : undefined;
    if (total != null && out.length >= total) break;
    if (rows.length === 0 || added === 0) break;

    const next = extractOpportunityCursor(body);
    if (!next) break;
    cursor = next;
    page += 1;
  }

  onProgress?.(`Oportunidades: ${out.length} carregadas.`);
  return out;
}

export async function fetchGhlContacts(
  token: string,
  locationId: string,
  onProgress?: (msg: string) => void,
): Promise<GhlContact[]> {
  const out: GhlContact[] = [];
  const seen = new Set<string>();

  let page = 1;
  const maxPages = 200;
  while (page <= maxPages) {
    onProgress?.(`Contatos: página ${page}…`);
    try {
      const body = await ghlRequest(token, "/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          pageLimit: 100,
          page,
        }),
      });
      const rows = extractArray(body, ["contacts", "data"]);
      if (rows.length === 0) break;
      for (const row of rows) {
        const mapped = mapGhlContactFromRaw(row);
        if (mapped && !seen.has(mapped.id)) {
          seen.add(mapped.id);
          out.push(mapped);
        }
      }
      const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as GhlJson) : body;
      const totalPages = pickNumber(meta, "totalPages", "total_pages");
      if (totalPages != null && page >= totalPages) break;
      if (rows.length < 100) break;
      page += 1;
    } catch (err) {
      if (page === 1) break;
      throw err;
    }
  }

  if (out.length > 0) {
    onProgress?.(`Contatos: ${out.length} carregados.`);
    return out;
  }

  let startAfterId: string | undefined;
  page = 0;
  while (page < maxPages) {
    const body = await ghlRequest(token, "/contacts/", {
      method: "GET",
      searchParams: {
        locationId,
        limit: "100",
        startAfterId,
      },
    });
    const rows = extractArray(body, ["contacts", "data"]);
    if (rows.length === 0) break;
    for (const row of rows) {
      const mapped = mapGhlContactFromRaw(row);
      if (mapped && !seen.has(mapped.id)) {
        seen.add(mapped.id);
        out.push(mapped);
      }
    }
    const next = extractNextCursor(body);
    if (!next) break;
    startAfterId = next;
    page += 1;
  }

  onProgress?.(`Contatos: ${out.length} carregados.`);
  return out;
}
