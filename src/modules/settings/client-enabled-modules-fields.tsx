"use client";

import { ASSIGNABLE_MODULE_KEYS, MODULE_LABELS } from "@/lib/modules";
import { useLanguage } from "@/context/language-context";
import type { ModuleKey } from "@/types";

type Props = {
  value: ModuleKey[];
  onChange: (modules: ModuleKey[]) => void;
};

export function ClientEnabledModulesFields({ value, onChange }: Props) {
  const { t: lt } = useLanguage();

  const toggle = (key: ModuleKey) => {
    onChange(value.includes(key) ? value.filter((m) => m !== key) : [...value, key]);
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Available panels")}</label>
      <p className="mb-2 text-[0.7rem] text-[var(--muted)]">
        {lt("Client admins can assign only these panels to users in this account. Leave all unchecked to infer from existing users.")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ASSIGNABLE_MODULE_KEYS.map((key) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={value.includes(key)}
              onChange={() => toggle(key)}
              className="rounded border-[var(--border)]"
            />
            {lt(MODULE_LABELS[key])}
          </label>
        ))}
      </div>
    </div>
  );
}
