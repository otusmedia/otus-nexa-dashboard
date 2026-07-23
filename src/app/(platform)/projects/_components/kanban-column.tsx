"use client";

import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { KanbanColumnId, Project } from "../data";
import { ProjectKanbanCard } from "./project-kanban-card";

export function KanbanColumn({
  columnId,
  label,
  dotClass,
  projects,
  onAddProject,
  minimized,
  onToggleMinimize,
  dragHandleProps,
}: {
  columnId: KanbanColumnId;
  label: string;
  dotClass: string;
  projects: Project[];
  onAddProject: (columnId: KanbanColumnId) => void;
  minimized: boolean;
  onToggleMinimize: (columnId: KanbanColumnId) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement> | null;
}) {
  const { t: lt } = useLanguage();

  if (minimized) {
    return (
      <div className="flex h-full w-12 shrink-0 flex-col items-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#121212] py-2">
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          className="mb-2 cursor-grab text-[rgba(255,255,255,0.35)] active:cursor-grabbing"
          aria-label={lt("Reorder column")}
          title={lt("Drag to reorder")}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggleMinimize(columnId)}
          className="mb-3 rounded-md p-1 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          aria-label={lt("Expand column")}
          title={lt("Expand column")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span className={`mb-2 h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <div
          className="flex flex-1 items-center justify-center overflow-hidden"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <span className="text-[0.65rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.45)]">
            {lt(label)}
          </span>
        </div>
        <span className="mt-2 text-[0.65rem] text-[rgba(255,255,255,0.35)]">{projects.length}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-1.5 px-0.5">
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          className="cursor-grab rounded p-0.5 text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] active:cursor-grabbing"
          aria-label={lt("Reorder column")}
          title={lt("Drag to reorder")}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-[0.7rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
          {lt(label)}
          <span className="ml-1.5 text-[rgba(255,255,255,0.25)]">{projects.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => onToggleMinimize(columnId)}
          className="rounded p-0.5 text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.65)]"
          aria-label={lt("Minimize column")}
          title={lt("Minimize column")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
      <Droppable droppableId={columnId} type="PROJECT">
        {(dropProvided, dropSnapshot) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-1 transition-colors",
              dropSnapshot.isDraggingOver && "rounded-[8px] bg-[rgba(255,69,0,0.04)]",
            )}
          >
            {projects.map((project: Project, index: number) => (
              <Draggable key={project.id} draggableId={project.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
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
        {lt("Add New Project")}
      </button>
    </div>
  );
}
