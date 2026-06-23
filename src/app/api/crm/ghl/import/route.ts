import { NextResponse } from "next/server";
import { loadGhlImportConfigFromEnv, runGhlImport } from "@/lib/server/ghl/ghl-import";

type ImportBody = {
  clientSlug?: string;
  pipelineId?: string;
  pipelineIds?: string[];
  locationId?: string;
  dryRun?: boolean;
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-import-secret")?.trim() ?? "";
  const expected = process.env.GHL_IMPORT_SECRET?.trim() ?? "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: ImportBody = {};
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    body = {};
  }

  const config = loadGhlImportConfigFromEnv({
    clientSlug: body.clientSlug,
    pipelineId: body.pipelineId,
    pipelineIds: body.pipelineIds,
    locationId: body.locationId,
    dryRun: body.dryRun === true,
  });

  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing GHL_PRIVATE_TOKEN (or GHL_API_TOKEN) and GHL_LOCATION_ID in server environment.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await runGhlImport(config);
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
