"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { ClientUpdatesModule } from "@/modules/updates/client-updates-module";

export default function UpdatesPage() {
  return (
    <ModuleGuard module="updates">
      <ClientUpdatesModule />
    </ModuleGuard>
  );
}
