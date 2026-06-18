"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { CrmResumePipelineModule } from "@/modules/crm/crm-resume-pipeline-module";

export default function CrmResumePipelinePage() {
  return (
    <ModuleGuard module="crm">
      <CrmResumePipelineModule />
    </ModuleGuard>
  );
}
