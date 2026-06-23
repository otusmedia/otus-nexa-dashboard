"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDisplayDate } from "@/app/(platform)/projects/data";
import { useLanguage } from "@/context/language-context";
import type { AttentionItem } from "@/modules/agency-home/use-agency-home-data";
import type { TaskAttentionReason } from "@/lib/task-attention";
import { cn } from "@/lib/utils";

type FilterKey = "all" | TaskAttentionReason;

type Props = {
  items: AttentionItem[];
  onSelectClient: (slug: string) => void;
};

const FILTER_OPTIONS: FilterKey[] = ["all", "waiting_client", "agency_overdue", "client_changes"];

export function AgencyHomeAttentionTable({ items, onSelectClient }: Props) {
  const router = useRouter();
  const { t: lt } = useLanguage();
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.reason === filter);
  }, [filter, items]);

  const reasonLabel = (reason: TaskAttentionReason) => {
    switch (reason) {
      case "waiting_client":
        return lt("Waiting on client approval");
      case "client_changes":
        return lt("Client requested changes");
      case "agency_overdue":
        return lt("Agency overdue");
      case "due_soon":
        return lt("Due soon");
      default:
        return lt("On track");
    }
  };

  const filterLabel = (key: FilterKey) => {
    if (key === "all") return lt("All");
    return reasonLabel(key);
  };

  const openTask = (item: AttentionItem) => {
    onSelectClient(item.clientSlug);
    router.push(`/projects/${encodeURIComponent(item.projectId)}?taskId=${encodeURIComponent(item.taskId)}`);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-10 text-center">
        <p className="text-sm text-[rgba(255,255,255,0.55)]">{lt("No items need attention right now.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161616]">
      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] px-4 py-3">
        {FILTER_OPTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] transition",
              filter === key
                ? "bg-[rgba(255,69,0,0.18)] text-[#FF4500]"
                : "bg-white/[0.04] text-[rgba(255,255,255,0.45)] hover:text-white",
            )}
          >
            {filterLabel(key)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-[rgba(255,255,255,0.35)]">
              <th className="px-4 py-3 font-normal">{lt("Client")}</th>
              <th className="px-4 py-3 font-normal">{lt("Project")}</th>
              <th className="px-4 py-3 font-normal">{lt("Task")}</th>
              <th className="px-4 py-3 font-normal">{lt("Due")}</th>
              <th className="px-4 py-3 font-normal">{lt("Reason")}</th>
              <th className="px-4 py-3 font-normal">{lt("Owner")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.taskId}
                onClick={() => openTask(item)}
                className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-white">{item.clientName}</td>
                <td className="max-w-[140px] truncate px-4 py-3 text-[rgba(255,255,255,0.65)]">{item.projectName}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-white">{item.taskTitle}</td>
                <td className="px-4 py-3 tabular-nums text-[rgba(255,255,255,0.55)]">
                  {item.dueDate ? formatDisplayDate(item.dueDate) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px]",
                      item.reason === "waiting_client" && "bg-amber-500/15 text-amber-200",
                      item.reason === "client_changes" && "bg-purple-500/15 text-purple-200",
                      item.reason === "agency_overdue" && "bg-red-500/15 text-red-200",
                    )}
                  >
                    {reasonLabel(item.reason)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[rgba(255,255,255,0.55)]">{item.owner || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-[rgba(255,255,255,0.45)]">
          {lt("No items match this filter.")}
        </p>
      ) : null}
    </div>
  );
}
