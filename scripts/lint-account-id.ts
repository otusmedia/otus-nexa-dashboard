/**
 * Blocks Portfolio / Deliveries code from using legacy client_slug.
 * New modules must scope by account_id only.
 *
 * Run: npm run lint:account-id
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const SCOPED_DIR_GLOBS = [
  "src/app/(platform)/portfolio",
  "src/app/(platform)/deliveries",
  "src/app/(public)/p",
  "src/app/(public)/d",
  "src/components/portfolio",
  "src/components/deliveries",
  "src/modules/portfolio",
  "src/modules/deliveries",
  "src/lib/portfolio",
  "src/lib/deliveries",
];

const SCOPED_FILE_PREFIXES = ["src/lib/portfolio", "src/lib/deliveries"];

const FORBIDDEN = /\bclient_slug\b|\bclientSlug\b/;

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      out.push(full);
    }
  }
}

function collectFiles(): string[] {
  const files: string[] = [];
  for (const rel of SCOPED_DIR_GLOBS) {
    walk(join(ROOT, rel), files);
  }
  for (const prefix of SCOPED_FILE_PREFIXES) {
    for (const ext of [".ts", ".tsx"]) {
      const full = join(ROOT, `${prefix}${ext}`);
      try {
        if (statSync(full).isFile()) files.push(full);
      } catch {
        /* missing ok */
      }
    }
  }
  return [...new Set(files)];
}

const violations: Array<{ file: string; line: number; text: string }> = [];

for (const file of collectFiles()) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((text, i) => {
    if (FORBIDDEN.test(text)) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        text: text.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error("lint:account-id — client_slug / clientSlug is forbidden in Portfolio & Deliveries:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}: ${v.text}`);
  }
  console.error("\nUse account_id only. See PRE_LAUNCH_CHECKLIST.md and docs/media-signed-urls.md.");
  process.exit(1);
}

console.log("lint:account-id — OK (no client_slug in Portfolio/Deliveries scoped paths)");
