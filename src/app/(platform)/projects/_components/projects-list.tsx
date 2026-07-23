"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { isAgencyCompany } from "@/lib/client-utils";
import { ProgressInline } from "./progress-inline";
import { ProjectStatusBadge } from "./project-status-badge";
import {
  KANBAN_COLUMNS,
  formatDisplayDate,
  mergeProjectsByColumn,
  type ProjectStatus,
} from "../data";

export function ProjectsList() {
  const {
    projectsByColumn,
    clients,
    projectsClientFilter,
    setProjectsClientFilter,
    currentUser,
  } = useAppContext();
  const { t: lt } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const projects = useMemo(() => {
    const merged = mergeProjectsByColumn(projectsByColumn);
    const filtered =
      statusFilter === "all" ? merged : merged.filter((p) => p.status === statusFilter);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [projectsByColumn, statusFilter]);

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">
          {projects.length} {lt("projects")}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)]">
            <span className="uppercase tracking-[0.08em]">{lt("Status")}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value as "all" | ProjectStatus) || "all")}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm text-white"
            >
              <option value="all">{lt("All statuses")}</option>
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.label}>
                  {lt(col.label)}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-[rgba(255,255,255,0.06)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[#121212] text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
              <th className="px-3 py-2.5 font-normal">{lt("Project")}</th>
              <th className="px-3 py-2.5 font-normal">{lt("Status")}</th>
              <th className="px-3 py-2.5 font-normal">{lt("Owners")}</th>
              <th className="px-3 py-2.5 font-normal">{lt("Progress")}</th>
              <th className="px-3 py-2.5 font-normal">{lt("Due date")}</th>
              {isAgencyCompany(currentUser.company) ? (
                <th className="px-3 py-2.5 font-normal">{lt("Client")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td
                  colSpan={isAgencyCompany(currentUser.company) ? 6 : 5}
                  className="px-3 py-10 text-center text-[rgba(255,255,255,0.45)]"
                >
                  {lt("No projects match this filter.")}
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const clientName =
                  clients.find((c) => c.slug === project.clientSlug)?.name ?? project.clientSlug ?? "—";
                return (
                  <tr
                    key={project.id}
                    className="border-b border-[rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <td className="px-3 py-3">
                      <Link href={`/projects/${project.id}`} className="text-white hover:text-[#ff4500]">
                        {project.name}
                      </Link>
                      <p className="mt-0.5 text-[0.7rem] text-[rgba(255,255,255,0.35)]">{lt(project.type)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-3 py-3 text-[rgba(255,255,255,0.65)]">
                      {project.owners.length ? project.owners.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[140px]">
                        <ProgressInline value={project.progress} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[rgba(255,255,255,0.65)]">
                      {formatDisplayDate(project.dueDate)}
                    </td>
                    {isAgencyCompany(currentUser.company) ? (
                      <td className="px-3 py-3 text-[rgba(255,255,255,0.65)]">{clientName}</td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
