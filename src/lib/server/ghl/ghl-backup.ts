import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type GhlBackupBundle = {
  backedUpAt: string;
  clientSlug: string;
  dryRun: boolean;
  leads: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
};

export function writeGhlImportBackup(input: {
  clientSlug: string;
  dryRun: boolean;
  leads: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
}): string | null {
  if (input.dryRun) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });

  const bundle: GhlBackupBundle = {
    backedUpAt: new Date().toISOString(),
    clientSlug: input.clientSlug,
    dryRun: false,
    leads: input.leads,
    contacts: input.contacts,
  };

  const filePath = join(dir, `ghl-${input.clientSlug}-${stamp}.json`);
  writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf8");
  return filePath;
}
