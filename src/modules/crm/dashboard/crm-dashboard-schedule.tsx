"use client";

import { formatAppointmentTime } from "@/lib/crm-data";
import type { CrmAppointmentWithLead } from "@/modules/crm/use-crm-dashboard-data";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  appointments: CrmAppointmentWithLead[];
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardSchedule({ appointments, loading, lt }: Props) {
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("Today's schedule")}</CrmDashboardSectionTitle>

      {loading ? (
        <ul className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4">
              <CrmDashboardSkeleton className="h-4 w-20" />
              <CrmDashboardSkeleton className="h-4 flex-1" />
            </li>
          ))}
        </ul>
      ) : appointments.length === 0 ? (
        <p className="mt-4 text-sm text-[rgba(255,255,255,0.4)]">{lt("No appointments scheduled.")}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {appointments.map((a) => (
            <li key={a.id} className="flex gap-4 text-sm">
              <span className="mono-num w-[7.5rem] shrink-0 text-[rgba(255,255,255,0.45)]">
                {formatAppointmentTime(a.time)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-white">{a.title}</span>
                <span className="block truncate text-xs text-[rgba(255,255,255,0.4)]">{a.leadName}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </CrmDashboardCard>
  );
}
