/**
 * Supabase backup / PITR recovery guide for GHL data.
 * Cannot query backups via API without Management API token — prints actionable steps.
 *
 * Usage: npm run ghl:backups
 */

import { loadGhlEnvFiles } from "./ghl-env";

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function main() {
  loadGhlEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = projectRefFromUrl(url);
  const dashboardBase = ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard";

  const guide = {
    projectUrl: url || "(not configured)",
    backupsDashboard: `${dashboardBase}/database/backups/restore`,
    pitrAvailableOn: "Supabase Pro plan and above (7-day Point-in-Time Recovery)",
    currentDbStatus: "Live database has 0 GHL rows for biotecc (run npm run ghl:diagnostic to re-check)",
    recoverySteps: [
      "1. Open Supabase Dashboard → Database → Backups",
      "2. Find a restore point AFTER the GHL test import and BEFORE the cleanup deletion",
      "3. Restore to a NEW temporary project (recommended) or use PITR clone",
      "4. In the restored project, run export queries or point .env.local to temp project and run: npm run ghl:export -- --client-slug=biotecc",
      "5. Switch .env.local back to production and merge: npm run ghl:merge -- --file=backups/ghl-export-biotecc-.../ghl-snapshot.json",
      "6. Verify with: npm run ghl:diagnostic",
    ],
    exportSqlForRestoredDb: `
SELECT * FROM crm_leads
WHERE client_slug = 'biotecc' AND external_id LIKE 'ghl:opp:%';

SELECT * FROM crm_contacts
WHERE client_slug = 'biotecc' AND external_id LIKE 'ghl:contact:%';
`.trim(),
    alternativeIfNoBackup: [
      "Request CSV export from former GHL account owner",
      "Temporarily reactivate GHL subaccount and re-run npm run ghl:import",
      "Check local backups/ folder for any ghl-*.json from future imports",
    ],
  };

  console.log(JSON.stringify(guide, null, 2));
}

main();
