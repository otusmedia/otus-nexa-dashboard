"use client";

import {
  ALL_CLIENT_APIS_ENABLED,
  CLIENT_API_KEYS,
  CLIENT_API_LABELS,
  EMPTY_CLIENT_APIS,
} from "@/lib/client-apis";
import type { ClientApiCredentials, ClientApiKey, ClientApisConfig } from "@/types";
import { cn } from "@/lib/utils";
import { ClientApiCredentialsFields } from "@/modules/settings/client-api-credentials-fields";

type ClientApisFieldsProps = {
  value: ClientApisConfig;
  onChange: (next: ClientApisConfig) => void;
  apiCredentials: ClientApiCredentials;
  onCredentialsChange: (next: ClientApiCredentials) => void;
  lt: (key: string) => string;
};

export function ClientApisFields({
  value,
  onChange,
  apiCredentials,
  onCredentialsChange,
  lt,
}: ClientApisFieldsProps) {
  const anyOn = CLIENT_API_KEYS.some((k) => value[k]);

  const setAll = (enabled: boolean) => {
    onChange(enabled ? { ...ALL_CLIENT_APIS_ENABLED } : { ...EMPTY_CLIENT_APIS });
  };

  const toggle = (key: ClientApiKey) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const anyIntegrationOn = CLIENT_API_KEYS.some((k) => value[k]);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Integrations")}</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
          <input
            type="checkbox"
            checked={anyOn}
            onChange={(e) => setAll(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          {lt("Enable all")}
        </label>
      </div>

      <ClientApiCredentialsFields
        value={apiCredentials}
        onChange={onCredentialsChange}
        lt={lt}
        highlight={anyIntegrationOn}
      />

      <div>
        <p className="mb-2 text-[11px] font-light text-[var(--muted)]">
          {lt("Choose which dashboards and widgets load data for this client.")}
        </p>
        <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {CLIENT_API_KEYS.map((key) => (
            <li key={key}>
              <label className={cn("flex cursor-pointer items-start gap-2 text-xs text-[var(--text)]")}>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={() => toggle(key)}
                  className="mt-0.5 rounded border-[var(--border)]"
                />
                <span>{lt(CLIENT_API_LABELS[key])}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
