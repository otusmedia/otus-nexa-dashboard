"use client";

import { ModuleGuard } from "@/components/layout/module-guard";

export default function CalendarPage() {
  return (
    <ModuleGuard module="calendar">
      <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center bg-black text-white">
        <h1 className="text-2xl font-semibold tracking-wide">CALENDAR</h1>
        <p className="mt-2 text-sm text-[rgba(255,255,255,0.5)]">Coming soon</p>
      </div>
    </ModuleGuard>
  );
}
