"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "../data";
import { formatDisplayDate } from "../data";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { OwnerAvatars } from "./owner-avatars";
import { ProgressInline } from "./progress-inline";

export function ProjectKanbanCard({
  project,
  isDragging,
}: {
  project: Project;
  isDragging?: boolean;
}) {
  const router = useRouter();
  const { deleteBoardProject } = useAppContext();
  const { t: lt } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "group relative rounded-[8px] border border-[var(--border)] bg-[#161616] transition-colors hover:border-[var(--border-strong)]",
        isDragging && "border-[#ff4500]/40 opacity-90",
      )}
    >
      <div
        className="pointer-events-none absolute right-1.5 top-1.5 z-20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
        ref={menuRef}
      >
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#1a1a1a] text-[rgba(255,255,255,0.55)] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:text-white"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">{lt("Menu")}</span>
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#141414] py-1 shadow-lg"
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-xs font-light text-white hover:bg-[rgba(255,255,255,0.06)]"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/projects/${project.id}`);
              }}
            >
              {lt("Open")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-xs font-light text-[#fca5a5] hover:bg-[rgba(239,68,68,0.12)]"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              {lt("Delete")}
            </button>
          </div>
        ) : null}
      </div>

      <Link href={`/projects/${project.id}`} className="block p-3">
        <p className="pr-8 text-sm font-normal leading-snug text-white">{project.name}</p>
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

      <DeleteConfirmModal
        open={confirmOpen}
        title={lt("Delete Project")}
        message={lt(
          "This will permanently delete {name} and all its tasks. This action cannot be undone.",
        ).replace("{name}", project.name)}
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          deleteBoardProject(project.id);
        }}
      />
    </div>
  );
}
