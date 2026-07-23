"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Settings2 } from "lucide-react";
import { emptyProjectsByColumn, type KanbanColumnId, type ProjectType } from "../data";
import { KanbanColumn } from "./kanban-column";
import { EditProjectStatusesModal } from "./edit-project-statuses-modal";
import { useProjectBoardStatuses } from "./use-project-board-statuses";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";
import { matchStatusToBoard } from "@/lib/project-board-statuses";
import {
  defaultProjectsBoardPrefs,
  readProjectsBoardPrefs,
  writeProjectsBoardPrefs,
  type ProjectsBoardPrefs,
} from "@/lib/projects-board-prefs";

export function ProjectsKanban() {
  const {
    projectsByColumn,
    moveProjectInKanban,
    addProject,
    projectsClientFilter,
    currentUser,
    reloadProjects,
  } = useAppContext();
  const { t: lt } = useLanguage();

  const boardClientSlug = useMemo(() => {
    if (isAgencyCompany(currentUser.company)) {
      return projectsClientFilter !== "all" ? projectsClientFilter : null;
    }
    return effectiveUserClientSlug(currentUser);
  }, [currentUser, projectsClientFilter]);

  const { statuses, canManage, save } = useProjectBoardStatuses(boardClientSlug, currentUser);

  const [modalOpen, setModalOpen] = useState(false);
  const [editStatusesOpen, setEditStatusesOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState<KanbanColumnId>("Planning");
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("Website");
  const [owner, setOwner] = useState("Matheus Canci");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [boardPrefs, setBoardPrefs] = useState<ProjectsBoardPrefs>(() => defaultProjectsBoardPrefs());

  const statusNames = useMemo(() => statuses.map((s) => s.name), [statuses]);

  useEffect(() => {
    setBoardPrefs(readProjectsBoardPrefs(currentUser.id, statusNames));
  }, [currentUser.id, statusNames]);

  const persistPrefs = useCallback(
    (next: ProjectsBoardPrefs) => {
      setBoardPrefs(next);
      writeProjectsBoardPrefs(currentUser.id, next);
    },
    [currentUser.id],
  );

  const orderedColumns = useMemo(() => {
    const byName = new Map(statuses.map((s) => [s.name, s]));
    return boardPrefs.columnOrder
      .map((name) => byName.get(name))
      .filter((s): s is (typeof statuses)[number] => Boolean(s));
  }, [boardPrefs.columnOrder, statuses]);

  const minimizedSet = useMemo(() => new Set(boardPrefs.minimized), [boardPrefs.minimized]);

  const groupedByStatus = useMemo(() => {
    const board = emptyProjectsByColumn(statusNames);
    for (const list of Object.values(projectsByColumn)) {
      for (const project of list) {
        const key = matchStatusToBoard(project.status, statuses);
        board[key] = board[key] ?? [];
        board[key].push({ ...project, column: key, status: key });
      }
    }
    return board;
  }, [projectsByColumn, statuses, statusNames]);

  const projectCount = useMemo(
    () => Object.values(groupedByStatus).reduce((total, list) => total + list.length, 0),
    [groupedByStatus],
  );

  const ownerOptions = [
    "Matheus Canci",
    "David Martins",
    "Matheus Foletto",
    "Camila Manager",
    "Lucas Rocha",
  ] as const;

  const openAddProjectModal = (columnId: KanbanColumnId) => {
    setTargetColumn(columnId);
    setName("");
    setType("Website");
    setOwner("Matheus Canci");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setNameError("");
    setModalOpen(true);
  };

  const closeAddProjectModal = () => {
    setModalOpen(false);
    setNameError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Project name is required.");
      return;
    }
    addProject({
      name: trimmed,
      type,
      owner,
      startDate: startDate || null,
      endDate: endDate || null,
      description: description.trim(),
      column: targetColumn,
    });
    closeAddProjectModal();
  };

  const toggleMinimize = (columnId: KanbanColumnId) => {
    const minimized = minimizedSet.has(columnId)
      ? boardPrefs.minimized.filter((id) => id !== columnId)
      : [...boardPrefs.minimized, columnId];
    persistPrefs({ ...boardPrefs, minimized });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "COLUMN") {
      const nextOrder = [...boardPrefs.columnOrder];
      const [moved] = nextOrder.splice(source.index, 1);
      if (!moved) return;
      nextOrder.splice(destination.index, 0, moved);
      persistPrefs({ ...boardPrefs, columnOrder: nextOrder });
      return;
    }

    moveProjectInKanban(result);
  };

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">
            {projectCount} {lt("projects")}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {canManage ? (
              <button
                type="button"
                onClick={() => setEditStatusesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-xs text-[rgba(255,255,255,0.55)] transition-colors hover:border-[rgba(255,255,255,0.16)] hover:text-white"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {lt("Edit statuses")}
              </button>
            ) : isAgencyCompany(currentUser.company) && projectsClientFilter === "all" ? (
              <span className="text-[0.7rem] text-[rgba(255,255,255,0.35)]">
                {lt("Select a client to edit board statuses.")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="h-[80vh] w-max overflow-hidden">
          <Droppable droppableId="projects-board-columns" direction="horizontal" type="COLUMN">
            {(boardProvided) => (
              <div
                ref={boardProvided.innerRef}
                {...boardProvided.droppableProps}
                className="flex h-full min-h-0 w-max flex-row gap-4 px-1 pb-4"
              >
                {orderedColumns.map((col, index) => (
                  <Draggable key={col.name} draggableId={`column:${col.name}`} index={index}>
                    {(colProvided) => (
                      <div ref={colProvided.innerRef} {...colProvided.draggableProps}>
                        <KanbanColumn
                          columnId={col.name}
                          label={col.name}
                          dotClass={col.dotClass}
                          projects={groupedByStatus[col.name] ?? []}
                          onAddProject={openAddProjectModal}
                          minimized={minimizedSet.has(col.name)}
                          onToggleMinimize={toggleMinimize}
                          dragHandleProps={colProvided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {boardProvided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

      <EditProjectStatusesModal
        open={editStatusesOpen}
        statuses={statuses}
        onClose={() => setEditStatusesOpen(false)}
        onSave={async (input) => {
          const saved = await save(input);
          if (saved) reloadProjects();
          return saved;
        }}
      />

      {modalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">{lt("Add New Project")}</h3>
              <button
                type="button"
                onClick={closeAddProjectModal}
                className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
              >
                {lt("Close")}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Project name")}</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  required
                />
                {nameError ? <p className="text-xs text-[#f87171]">{lt(nameError)}</p> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Project type")}</span>
                <select
                  value={type}
                  onChange={(e) => setType((e.target.value as ProjectType) || "Website")}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  <option value="Website">Website</option>
                  <option value="Monthly Content">Monthly Content</option>
                  <option value="Paid Traffic">Paid Traffic</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  {ownerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Start date")}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("End date")}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Description")}</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddProjectModal}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
              >
                {lt("Cancel")}
              </button>
              <button type="submit" className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
