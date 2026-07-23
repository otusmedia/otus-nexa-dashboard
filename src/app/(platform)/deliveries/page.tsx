"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";

/** Phase 0 stub — design + build come after signed-URL doc and Deliveries design. */
export default function DeliveriesPage() {
  const { t: lt } = useLanguage();

  return (
    <ModuleGuard module="deliveries">
      <PageHeader
        title={lt("Deliveries")}
        subtitle={lt("Private client video delivery — coming soon.")}
      />
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] text-center">
        <p className="text-sm text-[rgba(255,255,255,0.7)]">
          {lt("Deliveries module foundation is ready. Signed URLs and design are next.")}
        </p>
      </div>
    </ModuleGuard>
  );
}
