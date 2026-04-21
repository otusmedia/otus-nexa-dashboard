"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { CrmReportsModule } from "@/modules/crm/crm-reports-module";

export default function CrmReportsPage() {
  return (
    <ModuleGuard module="crm">
      <CrmReportsModule />
    </ModuleGuard>
  );
}
