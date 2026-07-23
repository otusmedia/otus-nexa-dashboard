"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { KANBAN_COLUMNS, type KanbanColumnId, type ProjectType } from "../data";
import { KanbanColumn } from "./kanban-column";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { isAgencyCompany } from "@/lib/client-utils";
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
    clients,
    projectsClientFilter,
    setProjectsClientFilter,
    currentUser,
  } = useAppContext();
  const { t: lt } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState<KanbanColumnId>("planning");
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("Website");
  const [owner, setOwner] = useState("Matheus Canci");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [boardPrefs, setBoardPrefs] = useState<ProjectsBoardPrefs>(() => defaultProjectsBoardPrefs());

  useEffect(() => {
    setBoardPrefs(readProjectsBoardPrefs(currentUser.id));
  }, [currentUser.id]);

  const persistPrefs = useCallback(
    (next: ProjectsBoardPrefs) => {
      setBoardPrefs(next);
      writeProjectsBoardPrefs(currentUser.id, next);
    },
    [currentUser.id],
  );

  const orderedColumns = useMemo(() => {
    const byId = new Map(KANBAN_COLUMNS.map((col) => [col.id, col]));
    return boardPrefs.columnOrder
      .map((id) => byId.get(id))
      .filter((col): col is (typeof KANBAN_COLUMNS)[number] => Boolean(col));
  }, [boardPrefs.columnOrder]);

  const minimizedSet = useMemo(() => new Set(boardPrefs.minimized), [boardPrefs.minimized]);

  const projectCount = useMemo(
    () => Object.values(projectsByColumn).reduce((total, list) => total + list.length, 0),
    [projectsByColumn],
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
          {isAgencyCompany(currentUser.company) ? (
            <label className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)]">
              <span className="uppercase tracking-[0.08em]">{lt("Client")}</span>
              <select
                value={projectsClientFilter}
                onChange={(e) => setProjectsClientFilter(e.target.value)}
                className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm text-white"
              >
                <option value="all">{lt("All Clients")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.slug}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
                  <Draggable key={col.id} draggableId={`column:${col.id}`} index={index}>
                    {(colProvided) => (
                      <div ref={colProvided.innerRef} {...colProvided.draggableProps}>
                        <KanbanColumn
                          columnId={col.id}
                          label={col.label}
                          dotClass={col.dotClass}
                          projects={projectsByColumn[col.id] ?? []}
                          onAddProject={openAddProjectModal}
                          minimized={minimizedSet.has(col.id)}
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
