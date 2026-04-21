"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { CrmDashboardModule } from "@/modules/crm/crm-dashboard-module";

export default function CrmDashboardPage() {
  return (
    <ModuleGuard module="crm">
      <CrmDashboardModule />
    </ModuleGuard>
  );
}
