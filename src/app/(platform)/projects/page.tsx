"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { ProjectsKanban } from "./_components/projects-kanban";

export default function ProjectsPage() {
  const { t } = useAppContext();
  const { t: lt } = useLanguage();
  return (
    <ModuleGuard module="projects">
      <div className="min-w-0 w-full overflow-x-hidden">
        <PageHeader
          title={t("projects")}
          subtitle={lt(
            "Board by status, owners, progress, and due dates. Open a card for full detail and tasks.",
          )}
        />
        <ProjectsKanban />
      </div>
    </ModuleGuard>
  );
}
