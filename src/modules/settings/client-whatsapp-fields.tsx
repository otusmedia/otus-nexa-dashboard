"use client";

import { isValidWhatsAppGroupUrl } from "@/lib/client-whatsapp-config";
import type { ClientWhatsAppConfig } from "@/types";
import { cn } from "@/lib/utils";

type ClientWhatsAppFieldsProps = {
  value: ClientWhatsAppConfig;
  onChange: (next: ClientWhatsAppConfig) => void;
  clientName: string;
  lt: (key: string) => string;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--muted)]">{label}</label>
      <input
        type="text"
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

export function ClientWhatsAppFields({ value, onChange, clientName, lt }: ClientWhatsAppFieldsProps) {
  const patch = (partial: Partial<ClientWhatsAppConfig>) => onChange({ ...value, ...partial });
  const displayName = value.displayName.trim() || clientName.trim() || lt("Client name");
  const urlValid = !value.groupInviteUrl.trim() || isValidWhatsAppGroupUrl(value.groupInviteUrl);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
            {lt("WhatsApp chat widget")}
          </p>
          <p className="mt-1 text-[11px] font-light text-[var(--muted)]">
            {lt("Floating button opens a chat-style popup; message is copied and the group link opens in WhatsApp.")}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="rounded border-[var(--border)]"
          />
          {lt("Enable WhatsApp widget")}
        </label>
      </div>

      <Field
        label={lt("Group invite link")}
        value={value.groupInviteUrl}
        onChange={(groupInviteUrl) => patch({ groupInviteUrl })}
        placeholder="https://chat.whatsapp.com/..."
        mono
      />
      {!urlValid ? (
        <p className="text-[11px] text-red-400">{lt("Enter a valid WhatsApp group link (chat.whatsapp.com or wa.me).")}</p>
      ) : null}

      <Field
        label={lt("Display name")}
        value={value.displayName}
        onChange={(displayName) => patch({ displayName })}
        placeholder={clientName || lt("Client name")}
      />
      <Field
        label={lt("Subtitle")}
        value={value.subtitle}
        onChange={(subtitle) => patch({ subtitle })}
        placeholder={lt("Usually replies within 10 minutes")}
      />
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Greeting message")}</label>
        <textarea
          value={value.greeting}
          onChange={(e) => patch({ greeting: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm text-[var(--text)]"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text)]">
        <input
          type="checkbox"
          checked={value.includeUserName}
          onChange={(e) => patch({ includeUserName: e.target.checked })}
          className="rounded border-[var(--border)]"
        />
        {lt("Include logged-in user name in copied message")}
      </label>

      <div className="rounded-lg border border-[var(--border)] bg-[#F5F0EB] p-3 text-[var(--text)]">
        <p className="mb-2 text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
          {lt("Widget preview")}
        </p>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-[11px] text-[var(--muted)]">{value.subtitle}</p>
          </div>
          <div className="bg-[#F5F0EB] px-3 py-3">
            <div className="inline-block max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs shadow-sm">
              {value.greeting}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
