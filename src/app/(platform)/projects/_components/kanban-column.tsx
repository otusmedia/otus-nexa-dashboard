"use client";

import { Draggable, Droppable } from "@hello-pangea/dnd";
import { useLanguage } from "@/context/language-context";
import type { KanbanColumnId, Project } from "../data";
import { ProjectKanbanCard } from "./project-kanban-card";

export function KanbanColumn({
  columnId,
  label,
  dotClass,
  projects,
  onAddProject,
}: {
  columnId: KanbanColumnId;
  label: string;
  dotClass: string;
  projects: Project[];
  onAddProject: (columnId: KanbanColumnId) => void;
}) {
  const { t: lt } = useLanguage();
  return (
    <div className="flex h-full min-h-0 min-w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2 px-0.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
          {lt(label)}
        </h2>
      </div>
      <Droppable droppableId={columnId}>
        {(dropProvided, dropSnapshot) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-1 transition-colors"
          >
            {projects.map((project: Project, index: number) => (
              <Draggable key={project.id} draggableId={project.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={dropSnapshot.isDraggingOver ? "rounded-[8px] border border-[#ff4500]/20 p-0.5" : ""}
                  >
                    <ProjectKanbanCard project={project} isDragging={dragSnapshot.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
      <button
        type="button"
        onClick={() => onAddProject(columnId)}
        className="mt-2 shrink-0 rounded-[8px] border border-dashed border-[var(--border-strong)] bg-transparent py-2.5 text-xs font-normal text-[rgba(255,255,255,0.4)] transition-colors hover:border-[var(--border)] hover:text-[var(--muted)]"
      >
        Add New Project
      </button>
    </div>
  );
}
