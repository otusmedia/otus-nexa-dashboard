/**
 * Applies supabase/crm-lead-service-product.sql when SUPABASE_DB_URL is set.
 * Example (Supabase → Project Settings → Database → Connection string → URI):
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres"
 *   npm run crm:migrate:service-product
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGhlEnvFiles } from "./ghl-env";

loadGhlEnvFiles();

const sqlPath = resolve(process.cwd(), "supabase/crm-lead-service-product.sql");
const dbUrl = process.env.SUPABASE_DB_URL?.trim();

async function main() {
  const sql = readFileSync(sqlPath, "utf8");

  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL in environment.");
    console.error("");
    console.error("Add your Supabase Postgres connection string to .env.local, then re-run:");
    console.error("  npm run crm:migrate:service-product");
    console.error("");
    console.error("Or paste this SQL in Supabase → SQL Editor:");
    console.error("  https://supabase.com/dashboard/project/ziijnolfwqeixywmhnwd/sql/new");
    console.error("");
    console.log(sql);
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied: crm_leads.service_product + crm_custom_service_products");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
