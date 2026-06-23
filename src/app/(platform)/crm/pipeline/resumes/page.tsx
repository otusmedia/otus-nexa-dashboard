"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { BUILTIN_RESUME_SLUG } from "@/lib/crm-funnels";
import { CrmFunnelPage } from "@/modules/crm/crm-funnel-page";

export default function CrmResumePipelinePage() {
  return (
    <ModuleGuard module="crm">
      <CrmFunnelPage funnelSlug={BUILTIN_RESUME_SLUG} />
    </ModuleGuard>
  );
}
