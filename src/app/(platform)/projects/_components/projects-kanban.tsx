"use client";

import { useMemo } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { KANBAN_COLUMNS } from "../data";
import { KanbanColumn } from "./kanban-column";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";

export function ProjectsKanban() {
  const { projectsByColumn, moveProjectInKanban } = useAppContext();
  const { t: lt } = useLanguage();

  const projectCount = useMemo(
    () => Object.values(projectsByColumn).reduce((total, list) => total + list.length, 0),
    [projectsByColumn],
  );

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <DragDropContext onDragEnd={moveProjectInKanban}>
        <div className="mb-3 px-1 text-xs font-light text-[rgba(255,255,255,0.4)]">
          {projectCount} {lt("projects")}
        </div>
        <div className="h-[80vh] w-max overflow-hidden">
          <div className="flex h-full min-h-0 w-max flex-row gap-4 px-1 pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                dotClass={col.dotClass}
                projects={projectsByColumn[col.id]}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
