"use client";

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
  const bg = eventDisplayColor(event);
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
        "max-w-full truncate rounded-full px-2 py-0.5 text-left text-xs font-medium transition-opacity hover:opacity-90",
        className,
      )}
      style={{
        backgroundColor: `${bg}33`,
        color: "#fff",
        border: `1px solid ${bg}55`,
      }}
    >
      <span className="block truncate">{event.title}</span>
    </button>
  );
}
