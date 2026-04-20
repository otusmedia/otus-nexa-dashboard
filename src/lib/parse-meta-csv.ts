import type { MetaAdsCampaign, MetaAdsSummary } from "@/types/meta-ads";

const COL = {
  start: "Início dos relatórios",
  end: "Encerramento dos relatórios",
  name: "Nome da campanha",
  status: "Veiculação da campanha",
  results: "Resultados",
  reach: "Alcance",
  frequency: "Frequência",
  costPerResult: "Custo por resultados",
  spent: "Valor usado (USD)",
  impressions: "Impressões",
  cpm: "CPM (custo por 1.000 impressões) (USD)",
  linkClicks: "Cliques no link",
  cpc: "CPC (custo por clique no link) (USD)",
  ctr: "CTR (taxa de cliques no link)",
  landing: "Visualizações da página de destino",
} as const;

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

function parseNumber(cell: string): number {
  if (!cell || !cell.trim()) return 0;
  let s = cell.trim().replace(/\u00a0/g, "");
  if (s === "—" || s === "-" || s === "N/A" || s === "n/a") return 0;
  s = s.replace(/%/g, "").replace(/\$/g, "").replace(/\s/g, "");
  s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function summarize(campaigns: MetaAdsCampaign[]): MetaAdsSummary {
  const totalSpent = campaigns.reduce((a, c) => a + c.amountSpent, 0);
  const totalImpressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const totalClicks = campaigns.reduce((a, c) => a + c.linkClicks, 0);
  const totalReach = campaigns.reduce((a, c) => a + c.reach, 0);
  const totalResults = campaigns.reduce((a, c) => a + c.results, 0);
  const averageCTR =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const averageCPL = totalResults > 0 ? totalSpent / totalResults : 0;
  return {
    totalSpent,
    totalImpressions,
    totalClicks,
    averageCTR,
    averageCPL,
    totalReach,
    totalResults,
  };
}

export function parseMetaAdsCsv(text: string): { campaigns: MetaAdsCampaign[]; summary: MetaAdsSummary } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { campaigns: [], summary: summarize([]) };
  }

  const headerCells = splitCsvLine(lines[0] ?? "").map((h) => h.replace(/^\ufeff/, ""));
  const idx = (name: string) => headerCells.findIndex((h) => h === name);

  const iStart = idx(COL.start);
  const iEnd = idx(COL.end);
  const iName = idx(COL.name);
  const iStatus = idx(COL.status);
  const iResults = idx(COL.results);
  const iReach = idx(COL.reach);
  const iFreq = idx(COL.frequency);
  const iCpr = idx(COL.costPerResult);
  const iSpent = idx(COL.spent);
  const iImp = idx(COL.impressions);
  const iCpm = idx(COL.cpm);
  const iLc = idx(COL.linkClicks);
  const iCpc = idx(COL.cpc);
  const iCtr = idx(COL.ctr);
  const iLand = idx(COL.landing);

  const pick = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i] ?? "" : "");

  const campaigns: MetaAdsCampaign[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r] ?? "");
    const campaignName = pick(cells, iName).trim();
    if (!campaignName || campaignName.toLowerCase().startsWith("total")) continue;

    campaigns.push({
      campaignName,
      startDate: pick(cells, iStart),
      endDate: pick(cells, iEnd),
      status: pick(cells, iStatus),
      results: parseNumber(pick(cells, iResults)),
      reach: parseNumber(pick(cells, iReach)),
      frequency: parseNumber(pick(cells, iFreq)),
      costPerResult: parseNumber(pick(cells, iCpr)),
      amountSpent: parseNumber(pick(cells, iSpent)),
      impressions: parseNumber(pick(cells, iImp)),
      cpm: parseNumber(pick(cells, iCpm)),
      linkClicks: parseNumber(pick(cells, iLc)),
      cpc: parseNumber(pick(cells, iCpc)),
      ctr: parseNumber(pick(cells, iCtr)),
      landingPageViews: parseNumber(pick(cells, iLand)),
    });
  }

  return { campaigns, summary: summarize(campaigns) };
}
