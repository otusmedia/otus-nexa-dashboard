"use client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import type { ModuleKey } from "@/types";

const moduleOptions: ModuleKey[] = ["dashboard", "tasks", "goals", "roadmap", "events", "ideas", "files", "contracts", "invoices", "marketing", "users"];

export default function UsersPage() {
  const { users, setUserModules, t } = useAppContext();
  return (
    <ModuleGuard module="users">
      <PageHeader title={t("users")} subtitle="Create users and assign module-level access through RBAC controls." />
      <Card className="mb-4">
        <p className="text-sm text-slate-600">{t("accessRestrictionNote")}</p>
      </Card>
      <div className="space-y-4">
        {users.map((user) => (
          <Card key={user.id}>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-slate-500">{t("role")}: {user.role}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {moduleOptions.map((module) => (
                <label key={`${user.id}-${module}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={user.modules.includes(module)}
                    onChange={(event) => {
                      const next = event.target.checked ? [...user.modules, module] : user.modules.filter((item) => item !== module);
                      setUserModules(user.id, next);
                    }}
                  />
                  {module}
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </ModuleGuard>
  );
}
