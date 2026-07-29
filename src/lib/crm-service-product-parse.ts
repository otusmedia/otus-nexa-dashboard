import { formatCrmServiceProductLabel } from "@/lib/crm-data";

/** Canonical units shown in the lead form unit picker. */
export const CRM_QUANTITY_UNITS = [
  "un",
  "mL",
  "L",
  "g",
  "kg",
  "mg",
  "t",
  "sc",
  "cx",
  "pct",
] as const;

export type CrmQuantityUnit = (typeof CRM_QUANTITY_UNITS)[number] | string;

export type ParsedCrmProductLine = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

const UNIT_CANON: Record<string, string> = {
  ml: "mL",
  mililitro: "mL",
  mililitros: "mL",
  l: "L",
  lt: "L",
  litro: "L",
  litros: "L",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  quilo: "kg",
  quilos: "kg",
  g: "g",
  gr: "g",
  grama: "g",
  gramas: "g",
  mg: "mg",
  un: "un",
  unid: "un",
  unidade: "un",
  unidades: "un",
  ton: "t",
  tonelada: "t",
  toneladas: "t",
  t: "t",
  sc: "sc",
  saco: "sc",
  sacos: "sc",
  cx: "cx",
  caixa: "cx",
  caixas: "cx",
  pct: "pct",
  pacote: "pct",
  pacotes: "pct",
  pack: "pct",
};

const UNIT_ALT = Object.keys(UNIT_CANON).sort((a, b) => b.length - a.length).join("|");

/** Non-product status-like labels that should stay as-is (no qty parse). */
const STATUS_LIKE =
  /^(nova proposta enviada|proposta enviada|venda fechada|proposta enviada biotecc|venda fechada biotecc)$/i;

export function canonicalizeCrmQuantityUnit(raw: string | null | undefined): string | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!key) return null;
  return UNIT_CANON[key] ?? String(raw).trim();
}

export function normalizeCrmQuantityUnitSelect(raw: string | null | undefined): string {
  return canonicalizeCrmQuantityUnit(raw) ?? "";
}

/**
 * Split a free-text blob (often `;`-separated) into product lines with
 * quantity/unit pulled out of the name when present.
 */
export function parseCrmServiceProductBlob(raw: string | null | undefined): ParsedCrmProductLine[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const chunks = text
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk) => parseCrmServiceProductLine(chunk));
}

export function parseCrmServiceProductLine(raw: string): ParsedCrmProductLine {
  let working = raw.trim().replace(/\s+/g, " ");
  if (!working) return { name: "", quantity: null, unit: null };

  if (STATUS_LIKE.test(working)) {
    return { name: formatCrmServiceProductLabel(working), quantity: null, unit: null };
  }

  const qtyUnitRe = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALT})\\.?`, "gi");
  const matches = [...working.matchAll(qtyUnitRe)];

  let quantity: number | null = null;
  let unit: string | null = null;

  if (matches.length) {
    const last = matches[matches.length - 1]!;
    const n = Number(last[1]!.replace(",", "."));
    if (Number.isFinite(n)) {
      quantity = n;
      unit = canonicalizeCrmQuantityUnit(last[2]!);
    }
    // Strip every qty+unit token from the product name.
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]!;
      const start = m.index ?? 0;
      working = `${working.slice(0, start)}${working.slice(start + m[0].length)}`;
    }
    working = working
      .replace(/\s*[-–—]\s*/g, " ")
      .replace(/\(\s*\)/g, "")
      .replace(/\s+/g, " ")
      .replace(/^[,;.\s]+|[,;.\s]+$/g, "")
      .trim();
  }

  return {
    name: formatCrmServiceProductLabel(working),
    quantity,
    unit,
  };
}

/** Primary line for a lead field (first fragment). */
export function primaryParsedCrmProduct(raw: string | null | undefined): ParsedCrmProductLine {
  const lines = parseCrmServiceProductBlob(raw);
  return lines[0] ?? { name: "", quantity: null, unit: null };
}
