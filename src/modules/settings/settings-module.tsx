"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { ALL_MODULE_KEYS, MODULE_LABELS, ROCKETRIDE_ALLOWED_MODULE_KEYS } from "@/lib/modules";
import type { AppUser, ModuleKey, Role, UserCompany } from "@/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  email: string;
  role: Role;
  modules: ModuleKey[];
  company: UserCompany;
};

type EditFormState = {
  name: string;
  email: string;
  role: Role;
  modules: ModuleKey[];
  company: UserCompany;
  password: string;
};

const COMPANY_OPTIONS: { value: Exclude<UserCompany, "">; labelKey: string }[] = [
  { value: "nexa", labelKey: "Nexa" },
  { value: "otus", labelKey: "Otus" },
  { value: "rocketride", labelKey: "RocketRide" },
];

function emptyForm(defaultCompany: UserCompany): FormState {
  return {
    name: "",
    email: "",
    role: "manager",
    modules: [],
    company: defaultCompany === "" ? "nexa" : defaultCompany,
  };
}

function emptyEditForm(user: AppUser): EditFormState {
  return {
    name: user.name,
    email: user.email ?? "",
    role: user.role,
    modules: [...user.modules],
    company: user.company === "" ? "nexa" : user.company,
    password: "",
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

function isNexaOtusAdmin(user: AppUser): boolean {
  return (user.company === "nexa" || user.company === "otus") && user.role === "admin";
}

function isRocketRideAdmin(user: AppUser): boolean {
  return user.company === "rocketride" && user.role === "admin";
}

function isNexaOtusManager(user: AppUser): boolean {
  return (user.company === "nexa" || user.company === "otus") && user.role === "manager";
}

function modulesInViewerScope(viewer: AppUser): ModuleKey[] {
  if (isNexaOtusAdmin(viewer)) return [...ALL_MODULE_KEYS];
  if (isNexaOtusManager(viewer)) return [...ALL_MODULE_KEYS];
  if (isRocketRideAdmin(viewer)) return [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
  if (viewer.company === "rocketride" && viewer.role === "manager") {
    return ALL_MODULE_KEYS.filter((k) => viewer.modules.includes(k) && ROCKETRIDE_ALLOWED_MODULE_KEYS.includes(k));
  }
  return [...ALL_MODULE_KEYS];
}

function moduleKeyToggleableByViewer(viewer: AppUser, key: ModuleKey): boolean {
  if (isNexaOtusAdmin(viewer)) return true;
  if (isNexaOtusManager(viewer)) return true;
  if (isRocketRideAdmin(viewer)) return ROCKETRIDE_ALLOWED_MODULE_KEYS.includes(key);
  if (viewer.company === "rocketride" && viewer.role === "manager") {
    return viewer.modules.includes(key) && ROCKETRIDE_ALLOWED_MODULE_KEYS.includes(key);
  }
  return false;
}

function canEditTargetUserModules(viewer: AppUser, target: AppUser): boolean {
  if (target.id === viewer.id) return false;
  if (isNexaOtusAdmin(viewer)) return true;
  if (isNexaOtusManager(viewer)) return target.company === viewer.company;
  if (isRocketRideAdmin(viewer)) return target.company === "rocketride";
  if (viewer.company === "rocketride" && viewer.role === "manager") {
    return target.company === "rocketride";
  }
  return false;
}

function canEditUser(viewer: AppUser, target: AppUser): boolean {
  if (isNexaOtusAdmin(viewer)) return true;
  if (isNexaOtusManager(viewer)) return target.company === viewer.company;
  if (isRocketRideAdmin(viewer)) return target.company === "rocketride";
  if (viewer.company === "rocketride" && viewer.role === "manager") {
    return target.company === "rocketride";
  }
  return false;
}

function canDeleteUser(viewer: AppUser, target: AppUser): boolean {
  if (target.id === viewer.id) return false;
  if (isNexaOtusAdmin(viewer)) return true;
  if (isNexaOtusManager(viewer)) return target.company === viewer.company;
  if (isRocketRideAdmin(viewer)) return target.company === "rocketride";
  return false;
}

export function SettingsModule() {
  const { users, addUser, updateUser, deleteUser, ts, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm("nexa"));
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [pendingModuleChanges, setPendingModuleChanges] = useState<Record<string, ModuleKey[]>>({});

  const viewerScopeModuleKeys = useMemo(() => modulesInViewerScope(currentUser), [currentUser]);

  const tableUsers = useMemo(() => {
    let list = [...users].sort((a, b) => a.name.localeCompare(b.name));
    if (isNexaOtusAdmin(currentUser)) return list;
    if (currentUser.company === "nexa" || currentUser.company === "otus") {
      return list.filter((u) => u.company === currentUser.company);
    }
    if (currentUser.company === "rocketride") {
      return list.filter((u) => u.company === "rocketride");
    }
    return list;
  }, [users, currentUser]);

  const canAddUsers =
    isNexaOtusAdmin(currentUser) ||
    isNexaOtusManager(currentUser) ||
    isRocketRideAdmin(currentUser);

  const pendingModuleChangeCount = useMemo(() => {
    let count = 0;
    for (const user of users) {
      const draft = pendingModuleChanges[user.id];
      if (!draft) continue;
      const a = [...draft].sort();
      const b = [...user.modules].sort();
      if (a.length !== b.length || a.some((m, i) => m !== b[i])) count += 1;
    }
    return count;
  }, [pendingModuleChanges, users]);

  const useStaticBadges =
    currentUser.company !== "nexa" && currentUser.company !== "otus" && currentUser.company !== "rocketride";

  const openAdd = () => {
    const defaultCompany: UserCompany =
      isRocketRideAdmin(currentUser) || (currentUser.company === "rocketride" && currentUser.role === "manager")
        ? "rocketride"
        : isNexaOtusManager(currentUser)
          ? currentUser.company
          : "nexa";
    setForm(emptyForm(defaultCompany));
    setAddModalOpen(true);
  };

  const saveAdd = () => {
    const name = form.name.trim();
    if (!name) return;
    const email = form.email.trim();
    const company: UserCompany =
      isRocketRideAdmin(currentUser) || (currentUser.company === "rocketride" && currentUser.role === "manager")
        ? "rocketride"
        : isNexaOtusManager(currentUser)
          ? currentUser.company
          : form.company || "nexa";
    let modules: ModuleKey[];
    if (form.role === "admin") {
      if (isNexaOtusAdmin(currentUser) || isNexaOtusManager(currentUser)) {
        modules = [...ALL_MODULE_KEYS];
      } else if (isRocketRideAdmin(currentUser)) {
        modules = [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
      } else {
        modules = [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
      }
    } else {
      modules = form.modules.filter((m) => viewerScopeModuleKeys.includes(m));
    }
    addUser({ name, email: email || null, role: form.role, modules, company });
    setAddModalOpen(false);
  };

  const openEdit = (user: AppUser) => {
    if (!canEditUser(currentUser, user)) return;
    setEditTarget(user);
    setEditForm(emptyEditForm(user));
  };

  const saveEdit = () => {
    if (!editTarget || !editForm) return;
    const name = editForm.name.trim();
    if (!name) return;
    let company: UserCompany = editForm.company;
    if (isRocketRideAdmin(currentUser) || (currentUser.company === "rocketride" && currentUser.role === "manager")) {
      company = "rocketride";
    } else if (isNexaOtusManager(currentUser)) {
      company = currentUser.company;
    }
    let role: Role = editForm.role;
    if (isRocketRideAdmin(currentUser) && editTarget.id === currentUser.id) {
      role = editTarget.role;
    }
    let modules: ModuleKey[];
    if (role === "admin") {
      modules = company === "rocketride" ? [...ROCKETRIDE_ALLOWED_MODULE_KEYS] : [...ALL_MODULE_KEYS];
    } else {
      const rrViewer =
        isRocketRideAdmin(currentUser) || (currentUser.company === "rocketride" && currentUser.role === "manager");
      modules =
        company === "rocketride" && rrViewer
          ? editForm.modules.filter((m) => ROCKETRIDE_ALLOWED_MODULE_KEYS.includes(m))
          : [...editForm.modules];
    }
    const payload: Parameters<typeof updateUser>[1] = {
      name,
      email: editForm.email.trim() || null,
      company,
      role,
      modules,
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }
    updateUser(editTarget.id, payload);
    setEditTarget(null);
    setEditForm(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteUser(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleModuleForUser = (user: AppUser, key: ModuleKey) => {
    if (!canEditTargetUserModules(currentUser, user)) return;
    if (!moduleKeyToggleableByViewer(currentUser, key)) return;
    const source = pendingModuleChanges[user.id] ?? user.modules;
    const has = source.includes(key);
    const next = has ? source.filter((m) => m !== key) : [...source, key];
    setPendingModuleChanges((prev) => ({ ...prev, [user.id]: next }));
  };

  const effectiveModulesForUser = (user: AppUser): ModuleKey[] => pendingModuleChanges[user.id] ?? user.modules;

  const saveAllPermissionChanges = () => {
    if (pendingModuleChangeCount === 0) return;
    for (const user of users) {
      const draft = pendingModuleChanges[user.id];
      if (!draft) continue;
      const a = [...draft].sort();
      const b = [...user.modules].sort();
      const changed = a.length !== b.length || a.some((m, i) => m !== b[i]);
      if (!changed) continue;
      updateUser(user.id, { modules: draft });
    }
    setPendingModuleChanges({});
  };

  const discardAllPermissionChanges = () => {
    setPendingModuleChanges({});
  };

  const displayModulesForStaticBadges = (user: AppUser) => user.modules;

  const editCompanyLocked =
    isRocketRideAdmin(currentUser) ||
    (currentUser.company === "rocketride" && currentUser.role === "manager") ||
    isNexaOtusManager(currentUser);

  const editRoleLocked = Boolean(
    editTarget && isRocketRideAdmin(currentUser) && editTarget.id === currentUser.id,
  );

  const editModuleScopeKeys =
    editTarget && (isRocketRideAdmin(currentUser) || (editTarget.company === "rocketride" && currentUser.company === "rocketride"))
      ? [...ROCKETRIDE_ALLOWED_MODULE_KEYS]
      : viewerScopeModuleKeys;

  return (
    <>
      <PageHeader title={lt("SETTINGS")} subtitle={lt("User management and permissions")} />

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-xs font-normal uppercase tracking-[0.12em] text-[var(--muted)]">{lt("USERS")}</h2>
          <div className="flex items-center gap-2">
            {pendingModuleChangeCount > 0 ? (
              <>
                <button type="button" onClick={discardAllPermissionChanges} className="btn-ghost rounded-lg px-3 py-2 text-sm">
                  {lt("Discard changes")}
                </button>
                <button type="button" onClick={saveAllPermissionChanges} className="btn-primary rounded-lg px-3 py-2 text-sm">
                  {lt("Save permissions")} ({pendingModuleChangeCount})
                </button>
              </>
            ) : null}
            {canAddUsers ? (
              <button type="button" onClick={openAdd} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Add User")}
              </button>
            ) : null}
          </div>
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
                const showEdit = canEditUser(currentUser, user);
                const showDelete = canDeleteUser(currentUser, user);
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
                            const active = effectiveModulesForUser(user).includes(key);
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
                      <div className="flex flex-wrap justify-end gap-1">
                        {showEdit ? (
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="btn-ghost rounded px-2 py-1 text-xs"
                          >
                            {lt("Edit")}
                          </button>
                        ) : null}
                        {showDelete ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            className="btn-primary rounded px-2 py-1 text-xs"
                          >
                            {lt("Delete")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={addModalOpen} title={lt("Add user")} onClose={() => setAddModalOpen(false)} closeLabel={lt("Close")}>
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
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder={lt("Email")}
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Company")}</label>
            {isRocketRideAdmin(currentUser) || (currentUser.company === "rocketride" && currentUser.role === "manager") ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--muted)]">
                {lt("RocketRide")}
              </div>
            ) : isNexaOtusManager(currentUser) ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--muted)]">
                {currentUser.company === "nexa" ? lt("Nexa") : lt("Otus")}
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
          <button type="button" onClick={saveAdd} className="btn-primary w-full rounded-lg px-3 py-2 text-sm">
            {lt("Save")}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget && editForm)}
        title={lt("Edit user")}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        closeLabel={lt("Close")}
      >
        {editForm && editTarget ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Name")}</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Email")}</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                placeholder={lt("Email")}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Company")}</label>
              {editCompanyLocked ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--muted)]">
                  {editForm.company === "nexa"
                    ? lt("Nexa")
                    : editForm.company === "otus"
                      ? lt("Otus")
                      : lt("RocketRide")}
                </div>
              ) : (
                <select
                  value={editForm.company === "" ? "nexa" : editForm.company}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, company: e.target.value as UserCompany } : prev,
                    )
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
                value={editForm.role}
                disabled={editRoleLocked}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  setEditForm((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      role,
                      modules:
                        role === "admin"
                          ? isNexaOtusAdmin(currentUser) || isNexaOtusManager(currentUser)
                            ? [...ALL_MODULE_KEYS]
                            : [...ROCKETRIDE_ALLOWED_MODULE_KEYS]
                          : prev.modules.filter((m) => editModuleScopeKeys.includes(m)),
                    };
                  });
                }}
                className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="admin">{ts("admin")}</option>
                <option value="manager">{ts("manager")}</option>
              </select>
            </div>
            {editForm.role === "manager" ? (
              <div>
                <p className="mb-2 text-xs text-[var(--muted)]">{lt("Module Access")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {editModuleScopeKeys.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={editForm.modules.includes(key)}
                        onChange={(e) => {
                          setEditForm((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              modules: e.target.checked
                                ? [...prev.modules, key]
                                : prev.modules.filter((m) => m !== key),
                            };
                          });
                        }}
                        className="rounded border-[var(--border)]"
                      />
                      {lt(MODULE_LABELS[key])}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Password")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={editForm.password}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, password: e.target.value } : prev))}
                placeholder={lt("Leave empty to keep current password")}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button type="button" onClick={saveEdit} className="btn-primary w-full rounded-lg px-3 py-2 text-sm">
              {lt("Save")}
            </button>
          </div>
        ) : null}
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
