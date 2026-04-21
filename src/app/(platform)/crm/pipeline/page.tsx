"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { CrmPipelineModule } from "@/modules/crm/crm-pipeline-module";

export default function CrmPipelinePage() {
  return (
    <ModuleGuard module="crm">
      <CrmPipelineModule />
    </ModuleGuard>
  );
}
