"use client";

import { CalendarModule } from "@/components/calendar/CalendarModule";
import { ModuleGuard } from "@/components/layout/module-guard";

export default function CalendarPage() {
  return (
    <ModuleGuard module="calendar">
      <CalendarModule />
    </ModuleGuard>
  );
}
