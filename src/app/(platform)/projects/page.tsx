"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { ProjectsKanban } from "./_components/projects-kanban";
import { ProjectsList } from "./_components/projects-list";

type ProjectsViewMode = "board" | "list";

function viewStorageKey(userId: string) {
  return `projects-view-mode:${userId}`;
}

export default function ProjectsPage() {
  const { t, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [viewMode, setViewMode] = useState<ProjectsViewMode>("board");

  useEffect(() => {
    if (!currentUser.id) return;
    try {
      const saved = localStorage.getItem(viewStorageKey(currentUser.id));
      if (saved === "board" || saved === "list") setViewMode(saved);
    } catch {
      /* ignore */
    }
  }, [currentUser.id]);

  const setView = (mode: ProjectsViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(viewStorageKey(currentUser.id), mode);
    } catch {
      /* ignore */
    }
  };

  return (
    <ModuleGuard module="projects">
      <div className="min-w-0 w-full overflow-x-hidden">
        <PageHeader
          title={t("projects")}
          subtitle={lt(
            "Board by status, owners, progress, and due dates. Open a card for full detail and tasks.",
          )}
          action={
            <div className="inline-flex rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#161616] p-0.5">
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs transition-colors",
                  viewMode === "board"
                    ? "bg-[rgba(255,69,0,0.15)] text-[#ff4500]"
                    : "text-[rgba(255,255,255,0.45)] hover:text-white",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {lt("Board")}
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs transition-colors",
                  viewMode === "list"
                    ? "bg-[rgba(255,69,0,0.15)] text-[#ff4500]"
                    : "text-[rgba(255,255,255,0.45)] hover:text-white",
                )}
              >
                <List className="h-3.5 w-3.5" />
                {lt("List")}
              </button>
            </div>
          }
        />
        {viewMode === "board" ? <ProjectsKanban /> : <ProjectsList />}
      </div>
    </ModuleGuard>
  );
}
