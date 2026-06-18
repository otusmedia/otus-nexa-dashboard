"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

export function CrmPipelineShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t: lt } = useLanguage();
  const isSales = pathname === "/crm/pipeline";
  const isResumes = pathname === "/crm/pipeline/resumes";

  return (
    <div className="w-full min-w-0">
      <PageHeader title={lt("Pipeline")} subtitle={lt("Kanban pipeline")} />
      <nav className="mb-4 flex w-fit gap-1 rounded-[8px] border border-[var(--border)] p-1" aria-label={lt("Pipeline")}>
        <Link
          href="/crm/pipeline"
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-xs transition-colors",
            isSales
              ? "bg-[rgba(255,69,0,0.15)] text-white"
              : "text-[rgba(255,255,255,0.45)] hover:text-white",
          )}
        >
          {lt("Sales")}
        </Link>
        <Link
          href="/crm/pipeline/resumes"
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-xs transition-colors",
            isResumes
              ? "bg-[rgba(255,69,0,0.15)] text-white"
              : "text-[rgba(255,255,255,0.45)] hover:text-white",
          )}
        >
          {lt("Resumes")}
        </Link>
      </nav>
      {children}
    </div>
  );
}
