/**
 * Instagram Insights CSV (Meta Business Suite export shape).
 * Columns in order: Data, Alcance, Cliques no Link, Interações, Visitas ao Perfil, Visualizações
 */

export type InstagramDailyRecord = {
  date: string;
  reach: number;
  linkClicks: number;
  interactions: number;
  profileVisits: number;
  impressions: number;
};

/** Social metrics cards — derived from daily totals for the dashboard import flow. */
export type InstagramInsightMetricRow = {
  label: string;
  value: string;
  change: string;
  progress: number;
};

const HEADER_ROW = [
  "Data",
  "Alcance",
  "Cliques no Link",
  "Interações",
  "Visitas ao Perfil",
  "Visualizações",
] as const;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/^"|"$/g, ""));
}

function parseIntegerCell(cell: string): number {
  const cleaned = cell.trim().replace(/\u00a0/g, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "");
  if (!cleaned) return 0;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < HEADER_ROW.length) return false;
  return HEADER_ROW.every((expected, i) => cells[i]?.replace(/^\ufeff/, "").trim() === expected);
}

function rowAllNumericZero(
  reach: number,
  linkClicks: number,
  interactions: number,
  profileVisits: number,
  impressions: number,
): boolean {
  return reach === 0 && linkClicks === 0 && interactions === 0 && profileVisits === 0 && impressions === 0;
}

/** Parses CSV into daily records (skips header; skips all-zero numeric rows). */
export function parseInstagramDailyCsv(text: string): InstagramDailyRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headerCells = splitCsvLine(lines[0] ?? "");
  if (!isHeaderRow(headerCells)) {
    throw new Error(
      `Invalid header. Expected columns in order: ${HEADER_ROW.join(", ")}.`,
    );
  }

  const records: InstagramDailyRecord[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r] ?? "");
    if (cells.length < HEADER_ROW.length) continue;

    const date = (cells[0] ?? "").trim();
    if (!date) continue;

    const reach = parseIntegerCell(cells[1] ?? "");
    const linkClicks = parseIntegerCell(cells[2] ?? "");
    const interactions = parseIntegerCell(cells[3] ?? "");
    const profileVisits = parseIntegerCell(cells[4] ?? "");
    const impressions = parseIntegerCell(cells[5] ?? "");

    if (rowAllNumericZero(reach, linkClicks, interactions, profileVisits, impressions)) {
      continue;
    }

    records.push({
      date,
      reach,
      linkClicks,
      interactions,
      profileVisits,
      impressions,
    });
  }

  if (records.length === 0) {
    throw new Error("No data rows after filtering (all rows were zero or empty).");
  }

  return records;
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function pctChange(first: number, last: number): string {
  const base = Math.max(Math.abs(first), 1);
  const delta = ((last - first) / base) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function buildMetricsFromDailyRecords(records: InstagramDailyRecord[]): InstagramInsightMetricRow[] {
  const sum = (pick: (r: InstagramDailyRecord) => number) => records.reduce((acc, r) => acc + pick(r), 0);

  const totalReach = sum((r) => r.reach);
  const totalImpressions = sum((r) => r.impressions);
  const totalProfile = sum((r) => r.profileVisits);
  const totalInteractions = sum((r) => r.interactions);

  const first = records[0]!;
  const last = records[records.length - 1]!;

  const changeReach = records.length >= 2 ? pctChange(first.reach, last.reach) : "+0.0%";
  const changeImp = records.length >= 2 ? pctChange(first.impressions, last.impressions) : "+0.0%";
  const firstRate = first.impressions > 0 ? (first.interactions / first.impressions) * 100 : 0;
  const lastRate = last.impressions > 0 ? (last.interactions / last.impressions) * 100 : 0;
  const changeEng = records.length >= 2 ? pctChange(firstRate, lastRate) : "+0.0%";
  const changeProf = records.length >= 2 ? pctChange(first.profileVisits, last.profileVisits) : "+0.0%";

  const engagementRatePct = totalImpressions > 0 ? (totalInteractions / totalImpressions) * 100 : 0;
  const engagementValue = `${engagementRatePct.toFixed(1)}%`;

  const totals = [totalReach, totalImpressions, totalProfile, totalInteractions];
  const maxT = Math.max(...totals, 1);
  const bar = (t: number) => Math.min(100, Math.round((t / maxT) * 100));

  return [
    { label: "Reach", value: formatInt(totalReach), change: changeReach, progress: bar(totalReach) },
    { label: "Impressions", value: formatInt(totalImpressions), change: changeImp, progress: bar(totalImpressions) },
    {
      label: "Engagement Rate",
      value: engagementValue,
      change: changeEng,
      progress: bar(totalInteractions),
    },
    { label: "Profile Visits", value: formatInt(totalProfile), change: changeProf, progress: bar(totalProfile) },
  ];
}

/** Parses the Instagram daily CSV and returns metrics for the Social metrics cards (unchanged dashboard contract). */
export function parseInstagramInsightsCsv(text: string): { metrics: InstagramInsightMetricRow[] } {
  const records = parseInstagramDailyCsv(text);
  return { metrics: buildMetricsFromDailyRecords(records) };
}
