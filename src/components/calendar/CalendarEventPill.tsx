"use client";

import { Briefcase, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import { eventDisplayColor } from "./calendar-utils";

export function CalendarEventPill({
  event,
  onClick,
  className,
}: {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const col = eventDisplayColor(event);
  const showTaskLink =
    Boolean(event.is_scheduled_post || event.source === "scheduled_post") &&
    Boolean(event.scheduled_post_linked_task_id) &&
    String(event.publishing_status ?? "").toLowerCase() === "published";
  const tooltip = [event.title, new Date(event.start_at).toLocaleString(), event.description?.slice(0, 200)]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      title={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-left text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `${col}26`,
        color: col,
        borderLeft: `3px solid ${col}`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {event.source === "crm" ? <Briefcase className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden /> : null}
      {showTaskLink ? <Link2 className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
    </button>
  );
}
