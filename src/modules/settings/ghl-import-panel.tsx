"use client";

import { useState } from "react";
import { useLanguage } from "@/context/language-context";
import type { GhlImportResult } from "@/lib/server/ghl/ghl-types";

type GhlImportPanelProps = {
  clientSlug: string;
};

export function GhlImportPanel({ clientSlug }: GhlImportPanelProps) {
  const { t: lt } = useLanguage();
  const [secret, setSecret] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GhlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = async (dryRun: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/crm/ghl/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Import-Secret": secret.trim(),
        },
        body: JSON.stringify({
          clientSlug,
          pipelineId: pipelineId.trim() || undefined,
          dryRun,
        }),
      });
      const data = (await res.json()) as GhlImportResult & { error?: string };
      if (!res.ok && data.error) {
        setError(data.error);
        return;
      }
      setResult(data);
      if (!data.ok && data.errors?.length) {
        setError(data.errors.slice(0, 3).join(" · "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.2)] p-4">
      <p className="text-sm font-medium text-[var(--text)]">{lt("Import from Go High Level")}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {lt("Imports GHL contacts and opportunities into CRM for this client. Requires server env GHL_PRIVATE_TOKEN and GHL_LOCATION_ID.")}
      </p>
      <div className="mt-3 space-y-2">
        <label className="block text-xs text-[var(--muted)]">{lt("Import secret")}</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={lt("Same as GHL_IMPORT_SECRET on server")}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          autoComplete="off"
        />
        <label className="block text-xs text-[var(--muted)]">{lt("GHL pipeline ID (optional)")}</label>
        <input
          type="text"
          value={pipelineId}
          onChange={(e) => setPipelineId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || !secret.trim()}
          onClick={() => void runImport(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)] disabled:opacity-40"
        >
          {loading ? lt("Loading...") : lt("Preview import")}
        </button>
        <button
          type="button"
          disabled={loading || !secret.trim()}
          onClick={() => void runImport(false)}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {loading ? lt("Loading...") : lt("Run import")}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      {result ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/40 p-2 text-[10px] text-[var(--muted)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
