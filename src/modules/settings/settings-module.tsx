"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { ALL_MODULE_KEYS, MODULE_LABELS } from "@/lib/modules";
import type { AppUser, ModuleKey, Role, UserCompany } from "@/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  role: Role;
  modules: ModuleKey[];
  company: UserCompany;
};

const COMPANY_OPTIONS: { value: Exclude<UserCompany, "">; labelKey: string }[] = [
  { value: "nexa", labelKey: "Nexa" },
  { value: "otus", labelKey: "Otus" },
  { value: "rocketride", labelKey: "RocketRide" },
];

function emptyForm(defaultCompany: UserCompany): FormState {
  return {
    name: "",
    role: "manager",
    modules: [],
    company: defaultCompany === "" ? "nexa" : defaultCompany,
  };
}

function roleBadgeClass(role: Role) {
  return role === "admin"
    ? "border-[#FF4500] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
    : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]";
}

function companyBadgeClass(company: AppUser["company"]) {
  if (company === "nexa") {
    return "border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] text-[rgba(147,197,253,0.95)]";
  }
  if (company === "otus") {
    return "border border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.12)] text-[rgba(216,180,254,0.95)]";
  }
  if (company === "rocketride") {
    return "border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.45)]";
  }
  return "";
}

function staticModuleBadgeClass() {
  return "inline-flex rounded border border-[rgba(255,255,255,0.12)] bg-[#161616] px-1.5 py-0.5 text-[10px] font-normal text-white";
}

function moduleChipClass(active: boolean, interactive: boolean) {
  return cn(
    "inline-flex select-none rounded-[4px] border px-2 py-[3px] text-[0.72rem] font-normal transition-[background-color,border-color,color] duration-150 ease-out",
    active
      ? "border-[rgba(255,69,0,0.5)] bg-[rgba(255,69,0,0.2)] text-[#FF4500]"
      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.3)]",
    interactive ? "cursor-pointer hover:opacity-90" : "cursor-default",
  );
}

function isElevatedCompany(company: AppUser["company"]): boolean {
  return company === "nexa" || company === "otus";
}

function isRocketRideCompany(company: AppUser["company"]): boolean {
  return company === "rocketride";
}

function canEditTargetUserModules(viewer: AppUser, target: AppUser): boolean {
  if (target.id === viewer.id) return false;
  if (isElevatedCompany(viewer.company)) return true;
  if (isRocketRideCompany(viewer.company)) return target.company === "rocketride";
  return false;
}

function moduleKeyToggleableByViewer(viewer: AppUser, key: ModuleKey): boolean {
  if (isElevatedCompany(viewer.company)) return true;
  if (isRocketRideCompany(viewer.company)) return viewer.modules.includes(key);
  return false;
}

/** Modules this viewer may see as chips or grant in Add User (RocketRide = viewer.modules ∩ ALL, in product order). */
function modulesInViewerScope(viewer: AppUser): ModuleKey[] {
  if (isElevatedCompany(viewer.company)) return [...ALL_MODULE_KEYS];
  if (isRocketRideCompany(viewer.company)) {
    return ALL_MODULE_KEYS.filter((k) => viewer.modules.includes(k));
  }
  return [...ALL_MODULE_KEYS];
}

export function SettingsModule() {
  const { users, addUser, updateUser, deleteUser, ts, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm("nexa"));
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const elevatedViewer = isElevatedCompany(currentUser.company);
  const rocketRideViewer = isRocketRideCompany(currentUser.company);

  const viewerScopeModuleKeys = useMemo(
    () => modulesInViewerScope(currentUser),
    [currentUser],
  );

  const tableUsers = useMemo(() => {
    let list = [...users].sort((a, b) => a.name.localeCompare(b.name));
    if (rocketRideViewer) {
      list = list.filter((u) => u.company === "rocketride");
    }
    return list;
  }, [users, rocketRideViewer]);

  const openAdd = () => {
    const defaultCompany: UserCompany = rocketRideViewer ? "rocketride" : "nexa";
    setForm(emptyForm(defaultCompany));
    setModalOpen(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    const company: UserCompany = rocketRideViewer ? "rocketride" : form.company || "nexa";
    let modules: ModuleKey[];
    if (form.role === "admin") {
      modules = elevatedViewer ? [...ALL_MODULE_KEYS] : [...currentUser.modules];
    } else {
      modules = form.modules.filter((m) => viewerScopeModuleKeys.includes(m));
    }
    addUser({ name, role: form.role, modules, company });
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteUser(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleModuleForUser = (user: AppUser, key: ModuleKey) => {
    if (!canEditTargetUserModules(currentUser, user)) return;
    if (!moduleKeyToggleableByViewer(currentUser, key)) return;
    const has = user.modules.includes(key);
    const next = has ? user.modules.filter((m) => m !== key) : [...user.modules, key];
    updateUser(user.id, { modules: next });
  };

  const displayModulesForStaticBadges = (user: AppUser) => user.modules;

  const useStaticBadges = !elevatedViewer && !rocketRideViewer;

  return (
    <>
      <PageHeader title={lt("SETTINGS")} subtitle={lt("User management and permissions")} />

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-xs font-normal uppercase tracking-[0.12em] text-[var(--muted)]">{lt("USERS")}</h2>
          <button type="button" onClick={openAdd} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {lt("Add User")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-4 py-3 font-normal">{lt("Name")}</th>
                <th className="px-4 py-3 font-normal">{lt("Role")}</th>
                <th className="px-4 py-3 font-normal">{lt("Module Access")}</th>
                <th className="px-4 py-3 text-right font-normal">{lt("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tableUsers.map((user) => {
                const rowCanEditModules = canEditTargetUserModules(currentUser, user);
                return (
                  <tr key={user.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-xs text-[var(--text)]">
                          {user.name.trim().slice(0, 1).toUpperCase() || "?"}
                        </span>
                        <span className="font-normal text-[var(--text)]">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-normal capitalize",
                            roleBadgeClass(user.role),
                          )}
                        >
                          {ts(user.role)}
                        </span>
                        {user.company ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-normal uppercase tracking-[0.06em]",
                              companyBadgeClass(user.company),
                            )}
                          >
                            {user.company === "nexa"
                              ? lt("Nexa")
                              : user.company === "otus"
                                ? lt("Otus")
                                : lt("RocketRide")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {useStaticBadges ? (
                        <div className="flex flex-wrap gap-1">
                          {displayModulesForStaticBadges(user).map((key) => (
                            <span key={key} className={staticModuleBadgeClass()}>
                              {lt(MODULE_LABELS[key])}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex max-w-[520px] flex-wrap gap-1">
                          {viewerScopeModuleKeys.map((key) => {
                            const active = user.modules.includes(key);
                            const interactive =
                              rowCanEditModules && moduleKeyToggleableByViewer(currentUser, key);
                            const chipClass = moduleChipClass(active, interactive);
                            return interactive ? (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleModuleForUser(user, key)}
                                className={chipClass}
                              >
                                {lt(MODULE_LABELS[key])}
                              </button>
                            ) : (
                              <span key={key} className={chipClass}>
                                {lt(MODULE_LABELS[key])}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="btn-primary rounded px-2 py-1 text-xs"
                      >
                        {lt("Delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} title={lt("Add user")} onClose={() => setModalOpen(false)} closeLabel={lt("Close")}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Name")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={lt("Full name")}
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Company")}</label>
            {rocketRideViewer ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--muted)]">
                {lt("RocketRide")}
              </div>
            ) : (
              <select
                value={form.company === "" ? "nexa" : form.company}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    company: e.target.value as UserCompany,
                  }))
                }
                className="w-full rounded-lg px-3 py-2 text-sm"
              >
                {COMPANY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lt(opt.labelKey)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Role")}</label>
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                setForm((prev) => ({
                  ...prev,
                  role,
                  modules:
                    role === "admin"
                      ? []
                      : prev.modules.filter((m) => viewerScopeModuleKeys.includes(m)),
                }));
              }}
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="admin">{ts("admin")}</option>
              <option value="manager">{ts("manager")}</option>
            </select>
          </div>
          {form.role === "manager" ? (
            <div>
              <p className="mb-2 text-xs text-[var(--muted)]">{lt("Module Access")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {viewerScopeModuleKeys.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={form.modules.includes(key)}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          modules: e.target.checked
                            ? [...prev.modules, key]
                            : prev.modules.filter((m) => m !== key),
                        }));
                      }}
                      className="rounded border-[var(--border)]"
                    />
                    {lt(MODULE_LABELS[key])}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <button type="button" onClick={save} className="btn-primary w-full rounded-lg px-3 py-2 text-sm">
            {lt("Save")}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={lt("Delete user")}
        onClose={() => setDeleteTarget(null)}
        closeLabel={lt("Cancel")}
      >
        {deleteTarget ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              {lt("Remove ")}
              <span className="text-[var(--text)]">{deleteTarget.name}</span>
              {lt(" from the workspace? This cannot be undone.")}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">
                {lt("Cancel")}
              </button>
              <button type="button" onClick={confirmDelete} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Delete")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
