"use client";

import {
  DASHBOARD_CARD_KEYS,
  DASHBOARD_CARD_LABELS,
  type ClientDashboardCards,
  type DashboardCardKey,
} from "@/lib/client-dashboard-cards";
import { useLanguage } from "@/context/language-context";

type Props = {
  value: ClientDashboardCards;
  onChange: (cards: ClientDashboardCards) => void;
};

export function ClientDashboardCardsFields({ value, onChange }: Props) {
  const { t: lt } = useLanguage();

  const toggle = (key: DashboardCardKey) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Dashboard cards")}</label>
      <p className="mb-2 text-[0.7rem] leading-relaxed text-[var(--muted)]">
        {lt("Choose which cards appear on this client's dashboard. Uncheck to hide.")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {DASHBOARD_CARD_KEYS.map((key) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={value[key] !== false}
              onChange={() => toggle(key)}
              className="rounded border-[var(--border)]"
            />
            {lt(DASHBOARD_CARD_LABELS[key])}
          </label>
        ))}
      </div>
    </div>
  );
}
