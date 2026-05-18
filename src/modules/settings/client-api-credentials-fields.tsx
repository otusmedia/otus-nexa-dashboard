"use client";

import { useState } from "react";
import type { ClientApiCredentials } from "@/types";
import { cn } from "@/lib/utils";

type ClientApiCredentialsFieldsProps = {
  value: ClientApiCredentials;
  onChange: (next: ClientApiCredentials) => void;
  lt: (key: string) => string;
  highlight?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  reveal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  reveal?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--muted)]">{label}</label>
      <input
        type={reveal ? "text" : "password"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)]",
          mono && "font-mono",
        )}
      />
    </div>
  );
}

function configuredHint(value: string) {
  return value.trim().length > 0;
}

export function ClientApiCredentialsFields({
  value,
  onChange,
  lt,
  highlight,
}: ClientApiCredentialsFieldsProps) {
  const [showSecrets, setShowSecrets] = useState(false);
  const patch = (partial: Partial<ClientApiCredentials>) => onChange({ ...value, ...partial });

  const metaOk =
    configuredHint(value.metaAccessToken) &&
    configuredHint(value.metaAdAccountId);
  const ga4Ok = configuredHint(value.ga4PropertyId);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3",
        highlight ? "border-[var(--accent)]/40 bg-[rgba(255,69,0,0.06)]" : "border-[var(--border)] bg-[rgba(0,0,0,0.15)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
            {lt("API credentials")}
          </p>
          <p className="mt-1 text-[11px] font-light text-[var(--muted)]">
            {lt("Tokens and account IDs for this client. Leave blank to use server defaults (.env).")}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showSecrets}
            onChange={(e) => setShowSecrets(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          {lt("Show values")}
        </label>
      </div>

      <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
        Meta / Instagram
        {metaOk ? (
          <span className="ml-2 normal-case tracking-normal text-emerald-400/90">({lt("configured")})</span>
        ) : (
          <span className="ml-2 normal-case tracking-normal text-[var(--muted)]">({lt("using .env if empty")})</span>
        )}
      </p>
      <Field
        label={lt("Meta access token")}
        value={value.metaAccessToken}
        onChange={(metaAccessToken) => patch({ metaAccessToken })}
        placeholder="EAAxxxx..."
        mono
        reveal={showSecrets}
      />
      <Field
        label={lt("Meta ad account ID")}
        value={value.metaAdAccountId}
        onChange={(metaAdAccountId) => patch({ metaAdAccountId })}
        placeholder="1234567890 or act_1234567890"
        mono
        reveal={showSecrets}
      />
      <Field
        label={lt("Instagram business account ID")}
        value={value.metaInstagramId}
        onChange={(metaInstagramId) => patch({ metaInstagramId })}
        placeholder="17841400000000000"
        mono
        reveal={showSecrets}
      />

      <p className="pt-1 text-[11px] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
        Google Analytics 4
        {ga4Ok ? (
          <span className="ml-2 normal-case tracking-normal text-emerald-400/90">({lt("property set")})</span>
        ) : null}
      </p>
      <p className="text-[11px] font-light text-[var(--muted)]">
        {lt("Service account email and private key stay in server .env; set property ID per client.")}
      </p>
      <Field
        label={lt("GA4 property ID")}
        value={value.ga4PropertyId}
        onChange={(ga4PropertyId) => patch({ ga4PropertyId })}
        placeholder="123456789 or properties/123456789"
        mono
        reveal
      />
    </div>
  );
}
