"use client";

import type { CrmAppointmentWithLead } from "@/modules/crm/use-crm-dashboard-data";
import { cn } from "@/lib/utils";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type DateSlot = {
  dateKey: string;
  label: string;
  count: number;
  isToday: boolean;
  isNext: boolean;
};

type Props = {
  slots: DateSlot[];
  appointments: CrmAppointmentWithLead[];
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardAppointmentsGrid({ slots, appointments, loading, lt }: Props) {
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("Upcoming appointments")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CrmDashboardSkeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <div
                key={slot.dateKey}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition",
                  slot.isToday || slot.isNext
                    ? "border-white bg-white text-black"
                    : "border-white/[0.08] bg-[rgba(255,255,255,0.02)] text-white",
                )}
              >
                <span className="text-[0.65rem] font-medium uppercase tracking-wide opacity-70">
                  {slot.label}
                </span>
                <span className="mono-num mt-1 text-lg font-medium">{slot.count}</span>
              </div>
            ))}
          </div>

          {appointments.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
              {appointments.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-white">{a.title}</span>
                  <span className="shrink-0 text-xs text-[rgba(255,255,255,0.4)]">{a.leadName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex flex-1 items-center text-xs text-[rgba(255,255,255,0.35)]">
              {lt("No appointments scheduled.")}
            </p>
          )}
        </>
      )}
      </div>
    </CrmDashboardCard>
  );
}
