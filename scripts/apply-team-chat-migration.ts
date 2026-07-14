/**
 * Applies supabase/team-chat.sql when SUPABASE_DB_URL is set.
 * Or paste the SQL in Supabase → SQL Editor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGhlEnvFiles } from "./ghl-env";

loadGhlEnvFiles();

const sqlPath = resolve(process.cwd(), "supabase/team-chat.sql");
const dbUrl = process.env.SUPABASE_DB_URL?.trim();

async function main() {
  const sql = readFileSync(sqlPath, "utf8");

  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL. Paste supabase/team-chat.sql in Supabase SQL Editor.");
    console.error("https://supabase.com/dashboard/project/ziijnolfwqeixywmhnwd/sql/new");
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied: team-chat tables");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
