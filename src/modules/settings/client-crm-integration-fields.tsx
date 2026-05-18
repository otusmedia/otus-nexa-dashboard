"use client";

import { useMemo, useState } from "react";
import {
  buildCrmFormSnippet,
  CRM_PROVIDERS,
  generateIngestSecret,
  originsToText,
  textToOrigins,
} from "@/lib/client-crm-integration";
import type { ClientCrmIntegration, CrmIntegrationProvider } from "@/types";
import { cn } from "@/lib/utils";

type ClientCrmIntegrationFieldsProps = {
  value: ClientCrmIntegration;
  onChange: (next: ClientCrmIntegration) => void;
  clientSlug: string;
  lt: (key: string) => string;
};

const PROVIDER_LABELS: Record<CrmIntegrationProvider, string> = {
  nexa: "Nexa CRM (recommended — no Zapier/HubSpot)",
  webhook: "Webhook (Zapier / Make / n8n)",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  rdstation: "RD Station",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
  password,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  password?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--muted)]">{label}</label>
      <input
        type={password ? "password" : type}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm text-[var(--text)]",
          mono && "font-mono",
        )}
      />
    </div>
  );
}

export function ClientCrmIntegrationFields({ value, onChange, clientSlug, lt }: ClientCrmIntegrationFieldsProps) {
  const [originsText, setOriginsText] = useState(() => originsToText(value.allowedOrigins));
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const patch = (partial: Partial<ClientCrmIntegration>) => onChange({ ...value, ...partial });

  const endpoint = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/crm/submit`;
    }
    return "/api/crm/submit";
  }, []);

  const snippet = useMemo(
    () =>
      buildCrmFormSnippet({
        endpoint,
        clientSlug: clientSlug.trim() || "your-client-slug",
        ingestSecret: value.ingestSecret.trim() || "GENERATE_SECRET_IN_PANEL",
      }),
    [endpoint, clientSlug, value.ingestSecret],
  );

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const syncOrigins = (text: string) => {
    setOriginsText(text);
    patch({ allowedOrigins: textToOrigins(text) });
  };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
            {lt("Website form → CRM")}
          </p>
          <p className="mt-1 text-[11px] font-light text-[var(--muted)]">
            {value.provider === "nexa"
              ? lt("Webflow/static forms POST to Nexa and appear in this client's CRM pipeline — no paid middleware.")
              : lt("Static site forms POST to Nexa; Nexa forwards leads to an external CRM.")}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="rounded border-[var(--border)]"
          />
          {lt("Enabled")}
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("CRM provider")}</label>
        <select
          value={value.provider}
          onChange={(e) => {
            const provider = e.target.value as CrmIntegrationProvider;
            patch({
              provider,
              mirrorToInternalCrm: provider === "nexa" ? true : value.mirrorToInternalCrm,
            });
          }}
          className="w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm"
        >
          {CRM_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Ingest secret")}</label>
        <div className="flex gap-2">
          <input
            type={showSecrets ? "text" : "password"}
            value={value.ingestSecret}
            onChange={(e) => patch({ ingestSecret: e.target.value })}
            placeholder={lt("Generate a secret")}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            className="btn-ghost shrink-0 rounded-lg px-2 py-1 text-xs"
            onClick={() => patch({ ingestSecret: generateIngestSecret() })}
          >
            {lt("Generate")}
          </button>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showSecrets}
            onChange={(e) => setShowSecrets(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          {lt("Show secret")}
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Allowed origins (one per line)")}</label>
        <textarea
          value={originsText}
          onChange={(e) => syncOrigins(e.target.value)}
          placeholder={"https://www.cliente.com.br\nhttps://cliente.webflow.io"}
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 font-mono text-xs"
        />
        {value.provider === "nexa" ? (
          <p className="mt-1 text-[11px] font-light text-[var(--muted)]">
            {lt("Webflow: Project Settings → Custom Code → Footer — paste the snippet below. Include both .webflow.io and your custom domain.")}
          </p>
        ) : null}
      </div>

      {value.provider === "webhook" ? (
        <Field
          label={lt("Webhook URL")}
          value={value.webhookUrl}
          onChange={(webhookUrl) => patch({ webhookUrl })}
          placeholder="https://hooks.zapier.com/..."
          mono
        />
      ) : null}

      {value.provider === "hubspot" ? (
        <>
          <Field
            label={lt("HubSpot private app token")}
            value={value.hubspotAccessToken}
            onChange={(hubspotAccessToken) => patch({ hubspotAccessToken })}
            password={!showSecrets}
          />
          <Field
            label={lt("Pipeline ID (optional)")}
            value={value.hubspotPipelineId}
            onChange={(hubspotPipelineId) => patch({ hubspotPipelineId })}
            mono
          />
          <Field
            label={lt("Deal stage ID (optional)")}
            value={value.hubspotDealStageId}
            onChange={(hubspotDealStageId) => patch({ hubspotDealStageId })}
            mono
          />
        </>
      ) : null}

      {value.provider === "pipedrive" ? (
        <>
          <Field
            label={lt("Pipedrive API token")}
            value={value.pipedriveApiToken}
            onChange={(pipedriveApiToken) => patch({ pipedriveApiToken })}
            password={!showSecrets}
          />
          <Field
            label={lt("Pipeline ID")}
            value={value.pipedrivePipelineId}
            onChange={(pipedrivePipelineId) => patch({ pipedrivePipelineId })}
            mono
          />
          <Field
            label={lt("Stage ID")}
            value={value.pipedriveStageId}
            onChange={(pipedriveStageId) => patch({ pipedriveStageId })}
            mono
          />
        </>
      ) : null}

      {value.provider === "rdstation" ? (
        <>
          <Field
            label={lt("RD Station API token")}
            value={value.rdStationToken}
            onChange={(rdStationToken) => patch({ rdStationToken })}
            password={!showSecrets}
          />
          <Field
            label={lt("Conversion identifier")}
            value={value.rdStationConversionIdentifier}
            onChange={(rdStationConversionIdentifier) => patch({ rdStationConversionIdentifier })}
          />
        </>
      ) : null}

      {value.provider !== "nexa" ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
          <input
            type="checkbox"
            checked={value.mirrorToInternalCrm}
            onChange={(e) => patch({ mirrorToInternalCrm: e.target.checked })}
            className="rounded border-[var(--border)]"
          />
          {lt("Also save a copy in Nexa CRM (audit)")}
        </label>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.2)] p-2">
        <p className="mb-1 text-[11px] text-[var(--muted)]">{lt("Endpoint")}</p>
        <code className="block break-all text-[11px] text-[var(--text)]">{endpoint}</code>
        <button type="button" onClick={() => void copySnippet()} className="btn-ghost mt-2 rounded px-2 py-1 text-xs">
          {snippetCopied ? lt("Copied!") : lt("Copy HTML snippet")}
        </button>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] leading-snug text-[var(--muted)]">
          {snippet.slice(0, 600)}
          {snippet.length > 600 ? "…" : ""}
        </pre>
      </div>
    </div>
  );
}
