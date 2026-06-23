"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { useParams } from "next/navigation";
import { CrmFunnelPage } from "@/modules/crm/crm-funnel-page";

export default function CrmCustomFunnelPipelinePage() {
  const params = useParams();
  const funnelSlug = String(params.funnelSlug ?? "");

  return (
    <ModuleGuard module="crm">
      <CrmFunnelPage funnelSlug={funnelSlug} />
    </ModuleGuard>
  );
}
