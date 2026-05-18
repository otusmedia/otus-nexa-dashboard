import { NextResponse } from "next/server";
import { isGa4ConfiguredForClient, resolveGa4PropertyId } from "@/lib/client-api-credentials";
import { loadClientApiCredentialsFromRequest } from "@/lib/server/load-client-api-credentials";
import {
  fetchGa4DashboardSnapshot,
  fetchGa4DashboardSnapshotCustom,
  getGa4DashboardUnavailable,
  type Ga4DateRangeParam,
} from "@/lib/ga4";

export const dynamic = "force-dynamic";

function unixPairToUtcYmd(sinceSec: number, untilSec: number): { startYmd: string; endYmd: string } | null {
  if (!Number.isFinite(sinceSec) || !Number.isFinite(untilSec) || sinceSec >= untilSec) return null;
  const maxSpan = 366 * 24 * 60 * 60;
  if (untilSec - sinceSec > maxSpan) return null;
  const startYmd = new Date(sinceSec * 1000).toISOString().slice(0, 10);
  const endYmd = new Date(untilSec * 1000).toISOString().slice(0, 10);
  return { startYmd, endYmd };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawS = searchParams.get("since");
  const rawU = searchParams.get("until");
  const stored = await loadClientApiCredentialsFromRequest(request);
  const propertyId = resolveGa4PropertyId(stored);

  if (!isGa4ConfiguredForClient(stored)) {
    return NextResponse.json(getGa4DashboardUnavailable("GA4 credentials not configured"));
  }

  try {
    if (rawS != null && rawU != null && rawS !== "" && rawU !== "") {
      const sinceSec = Math.floor(Number(rawS));
      const untilSec = Math.floor(Number(rawU));
      const ymd = unixPairToUtcYmd(sinceSec, untilSec);
      if (ymd) {
        const data = await fetchGa4DashboardSnapshotCustom(ymd.startYmd, ymd.endYmd, propertyId);
        return NextResponse.json(data);
      }
    }

    const raw = searchParams.get("range") ?? "30d";
    const range: Ga4DateRangeParam =
      raw === "7d" || raw === "30d" || raw === "90d" ? raw : "30d";

    const data = await fetchGa4DashboardSnapshot(range, propertyId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "GA4 request failed";
    if (error instanceof Error) {
      const code = (error as Error & { code?: unknown }).code;
      console.error('GA4 error details:', error.message, code);
    } else {
      console.error('GA4 error details:', message, undefined);
    }
    return NextResponse.json(getGa4DashboardUnavailable(message), { status: 200 });
  }
}
