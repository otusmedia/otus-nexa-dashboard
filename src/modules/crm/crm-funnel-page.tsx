"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { funnelPipelinePath } from "@/lib/crm-funnels";
import { CrmFunnelPipelineModule } from "@/modules/crm/crm-funnel-pipeline-module";
import { useCrmFunnels } from "@/modules/crm/use-crm-funnels";

export function CrmFunnelPage({ funnelSlug }: { funnelSlug: string }) {
  const router = useRouter();
  const { t: lt } = useLanguage();
  const { funnels, loading } = useCrmFunnels();
  const normalizedSlug = funnelSlug.trim().toLowerCase();

  const funnel = useMemo(
    () => funnels.find((row) => row.slug === normalizedSlug) ?? null,
    [funnels, normalizedSlug],
  );

  if (loading) {
    return <p className="text-sm text-[rgba(255,255,255,0.45)]">{lt("Loading pipeline…")}</p>;
  }

  if (!funnel) {
    router.replace("/crm/pipeline");
    return null;
  }

  if (funnelPipelinePath(funnel.slug) !== funnelPipelinePath(funnelSlug)) {
    router.replace(funnelPipelinePath(funnel.slug));
    return null;
  }

  return <CrmFunnelPipelineModule funnel={funnel} />;
}
