"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { completeCrmAppointment, formatAppointmentTime } from "@/lib/crm-data";
import type { CrmAppointmentWithLead } from "@/modules/crm/use-crm-dashboard-data";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  appointments: CrmAppointmentWithLead[];
  loading: boolean;
  lt: (key: string) => string;
  onAppointmentCompleted?: () => void;
};

export function CrmDashboardSchedule({ appointments, loading, lt, onAppointmentCompleted }: Props) {
  const { currentUser, language } = useAppContext();
  const [completingId, setCompletingId] = useState<string | null>(null);
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("Today's schedule")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {loading ? (
        <ul className="space-y-4">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4">
              <CrmDashboardSkeleton className="h-4 w-20" />
              <CrmDashboardSkeleton className="h-4 flex-1" />
            </li>
          ))}
        </ul>
      ) : appointments.length === 0 ? (
        <p className="flex flex-1 items-center text-sm text-[rgba(255,255,255,0.4)]">
          {lt("No appointments scheduled.")}
        </p>
      ) : (
        <ul className="space-y-4">
          {appointments.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span className="mono-num w-[7.5rem] shrink-0 text-[rgba(255,255,255,0.45)]">
                {formatAppointmentTime(a.time)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-white">{a.title}</span>
                <span className="block truncate text-xs text-[rgba(255,255,255,0.4)]">{a.leadName}</span>
              </span>
              <button
                type="button"
                disabled={completingId === a.id || !currentUser.name?.trim()}
                title={lt("Mark as done")}
                onClick={() => {
                  if (!currentUser.name?.trim()) return;
                  setCompletingId(a.id);
                  void completeCrmAppointment(a.id, currentUser.name, language).then((r) => {
                    setCompletingId(null);
                    if (r.ok) onAppointmentCompleted?.();
                  });
                }}
                className="shrink-0 rounded-md border border-[rgba(34,197,94,0.35)] p-1.5 text-[#86efac] transition hover:bg-[rgba(34,197,94,0.12)] disabled:opacity-40"
              >
                <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </CrmDashboardCard>
  );
}
