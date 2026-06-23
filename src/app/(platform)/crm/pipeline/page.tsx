"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { BUILTIN_SALES_SLUG } from "@/lib/crm-funnels";
import { CrmFunnelPage } from "@/modules/crm/crm-funnel-page";

export default function CrmPipelinePage() {
  return (
    <ModuleGuard module="crm">
      <CrmFunnelPage funnelSlug={BUILTIN_SALES_SLUG} />
    </ModuleGuard>
  );
}
