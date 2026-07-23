/**
 * Applies supabase/portfolio.sql + portfolio-hero-savee.sql when SUPABASE_DB_URL is set.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGhlEnvFiles } from "./ghl-env";

loadGhlEnvFiles();

const files = [
  "supabase/portfolio.sql",
  "supabase/portfolio-hero-savee.sql",
  "supabase/portfolio-highlights.sql",
  "supabase/portfolio-project-page.sql",
  "supabase/portfolio-band-hero.sql",
];
const dbUrl = process.env.SUPABASE_DB_URL?.trim();

async function main() {
  if (!dbUrl) {
    console.error(
      "Missing SUPABASE_DB_URL. Paste the portfolio SQL files (including portfolio-project-page.sql) in Supabase SQL Editor.",
    );
    process.exit(1);
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const rel of files) {
      const sql = readFileSync(resolve(process.cwd(), rel), "utf8");
      await client.query(sql);
      console.log(`Migration applied: ${rel}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
