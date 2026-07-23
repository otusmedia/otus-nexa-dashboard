"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";

/** Phase 0 stub — design + build come in the Portfolio module cycle. */
export default function PortfolioPage() {
  const { t: lt } = useLanguage();

  return (
    <ModuleGuard module="portfolio">
      <PageHeader
        title={lt("Portfolio")}
        subtitle={lt("Public showcase for filmmaker work — coming soon.")}
      />
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] text-center">
        <p className="text-sm text-[rgba(255,255,255,0.7)]">
          {lt("Portfolio module foundation is ready. Design and build are next.")}
        </p>
      </div>
    </ModuleGuard>
  );
}
