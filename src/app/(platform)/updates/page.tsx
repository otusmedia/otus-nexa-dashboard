"use client";

import { useEffect } from "react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { ClientUpdatesModule } from "@/modules/updates/client-updates-module";

export default function UpdatesPage() {
  const { currentUser } = useAppContext();

  useEffect(() => {
    try {
      localStorage.setItem(`updates-last-seen-${currentUser.id}`, new Date().toISOString());
    } catch {
      /* ignore quota / private mode */
    }
  }, [currentUser.id]);

  return (
    <ModuleGuard module="updates">
      <ClientUpdatesModule />
    </ModuleGuard>
  );
}
