"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Project } from "../data";
import { formatDisplayDate } from "../data";
import { OwnerAvatars } from "./owner-avatars";
import { ProgressInline } from "./progress-inline";

export function ProjectKanbanCard({
  project,
  isDragging,
}: {
  project: Project;
  isDragging?: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "block rounded-[8px] border border-[var(--border)] bg-[#161616] p-3 transition-colors hover:border-[var(--border-strong)]",
        isDragging && "border-[#ff4500]/40 opacity-90",
      )}
    >
      <p className="text-sm font-normal leading-snug text-white">{project.name}</p>
      <div className="mt-2">
        <OwnerAvatars names={project.owners} />
      </div>
      <div className="mt-2">
        <ProgressInline value={project.progress} />
      </div>
      {project.dueDate ? (
        <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.4)]">
          Due <span className="mono-num">{formatDisplayDate(project.dueDate)}</span>
        </p>
      ) : null}
    </Link>
  );
}
