/**
 * Smoke test for Go High Level API connectivity.
 *
 * Usage:
 *   npm run ghl:test-api
 *   npm run ghl:test-api -- --client-slug=biotecc
 */

import { loadGhlEnvFiles } from "./ghl-env";

loadGhlEnvFiles();

async function main() {
  const { fetchGhlContacts, fetchGhlOpportunities, fetchGhlPipelines } = await import(
    "../src/lib/server/ghl/ghl-client"
  );

  const token = process.env.GHL_PRIVATE_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  const clientSlug = process.argv.find((a) => a.startsWith("--client-slug="))?.split("=")[1]?.trim()
    ?? process.env.GHL_CLIENT_SLUG?.trim()
    ?? "biotecc";

  if (!token || !locationId) {
    console.error("Configure GHL_PRIVATE_TOKEN and GHL_LOCATION_ID in .env.local");
    process.exit(1);
  }

  console.log(`GHL API smoke test — client: ${clientSlug}, location: ${locationId}`);

  try {
    const pipelines = await fetchGhlPipelines(token, locationId);
    console.log(`\nPipelines (${pipelines.length}):`);
    for (const p of pipelines) {
      console.log(`  - ${p.name} (id: ${p.id}, stages: ${p.stages.length})`);
    }

    const sitePipeline = pipelines.find((p) => p.name.trim().toLowerCase() === "site");
    const vendasPipeline = pipelines.find((p) => p.name.trim().toLowerCase() === "vendas");

    let totalOpps = 0;
    for (const p of pipelines) {
      const opps = await fetchGhlOpportunities(token, locationId, p.id);
      console.log(`  Opportunities in "${p.name}": ${opps.length}`);
      totalOpps += opps.length;
    }
    console.log(`\nTotal opportunities: ${totalOpps}`);

    const contacts = await fetchGhlContacts(token, locationId);
    console.log(`Total contacts: ${contacts.length}`);

    if (sitePipeline && vendasPipeline) {
      console.log(`\nRecommended GHL_PIPELINE_IDS=${sitePipeline.id},${vendasPipeline.id}`);
    } else {
      console.warn("\nWarning: could not find both Site and Vendas pipelines by name.");
    }

    console.log("\nAPI test passed.");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("403")) {
      console.error("\nGHL auth failed — token may be expired or revoked.");
    }
    console.error(msg);
    process.exit(1);
  }
}

main();
