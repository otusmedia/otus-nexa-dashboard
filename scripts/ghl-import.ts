/**
 * One-time / repeat GHL import for Biotecc (or any client slug).
 *
 * Usage:
 *   npx tsx scripts/ghl-import.ts
 *   npx tsx scripts/ghl-import.ts --dry-run
 *   npx tsx scripts/ghl-import.ts --client-slug=biotecc
 *
 * Requires in .env.local:
 *   GHL_PRIVATE_TOKEN, GHL_LOCATION_ID, GHL_CLIENT_SLUG=biotecc
 *   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const { loadGhlImportConfigFromEnv, runGhlImport } = await import("../src/lib/server/ghl/ghl-import");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const clientArg = args.find((a) => a.startsWith("--client-slug="));
  const pipelineArg = args.find((a) => a.startsWith("--pipeline-id="));
  const pipelineIdsArg = args.find((a) => a.startsWith("--pipeline-ids="));
  const locationArg = args.find((a) => a.startsWith("--location-id="));

  const pipelineIds = pipelineIdsArg
    ?.split("=")[1]
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const config = loadGhlImportConfigFromEnv({
    dryRun,
    clientSlug: clientArg?.split("=")[1],
    pipelineId: pipelineArg?.split("=")[1],
    pipelineIds,
    locationId: locationArg?.split("=")[1],
  });

  if (!config) {
    console.error(
      "Configure GHL_PRIVATE_TOKEN and GHL_LOCATION_ID (and optionally GHL_CLIENT_SLUG=biotecc) in .env.local",
    );
    process.exit(1);
  }

  console.log(`Importing GHL → CRM for client "${config.clientSlug}"${dryRun ? " (dry run)" : ""}...`);
  console.log("Fetching from Go High Level (opportunities, then contacts)...");
  const result = await runGhlImport(config);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
