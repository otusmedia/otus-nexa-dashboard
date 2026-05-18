"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { ClientLogo } from "@/components/ui/client-logo";
import { slugFromClientName } from "@/lib/client-utils";
import { readSvgFileAsDataUrl } from "@/lib/client-logo-upload";
import type { Client } from "@/types";
import { cn } from "@/lib/utils";

type ClientFormState = {
  name: string;
  slug: string;
  primaryColor: string;
  active: boolean;
  logoUrl: string | null;
};

function emptyClientForm(): ClientFormState {
  return { name: "", slug: "", primaryColor: "#FF4500", active: true, logoUrl: null };
}

type ClientsSettingsPanelProps = {
  onAddUserForClient: (clientSlug: string) => void;
};

export function ClientsSettingsPanel({ onAddUserForClient }: ClientsSettingsPanelProps) {
  const { users, clients, clientsLoading, addClient, updateClient } = useAppContext();
  const { t: lt } = useLanguage();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ClientFormState>(emptyClientForm);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState | null>(null);
  const [saveError, setSaveError] = useState("");

  const userCountBySlug = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const user of users) {
      const slug = user.clientSlug?.trim();
      if (!slug) continue;
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const handleLogoFile = async (file: File | undefined, apply: (url: string | null) => void) => {
    if (!file) return;
    const dataUrl = await readSvgFileAsDataUrl(file);
    if (!dataUrl) {
      setSaveError(lt("Please upload a valid SVG file."));
      return;
    }
    setSaveError("");
    apply(dataUrl);
  };

  const openAdd = () => {
    setForm(emptyClientForm());
    setSaveError("");
    setAddOpen(true);
  };

  const saveAdd = async () => {
    const name = form.name.trim();
    const slug = form.slug.trim().toLowerCase();
    if (!name || !slug) {
      setSaveError(lt("Name and slug are required."));
      return;
    }
    const result = await addClient({
      name,
      slug,
      primaryColor: form.primaryColor,
      active: form.active,
      logoUrl: form.logoUrl,
    });
    if (!result.ok) {
      setSaveError(result.error ?? lt("Could not save client."));
      return;
    }
    setAddOpen(false);
    setSaveError("");
  };

  const openEdit = (client: Client) => {
    setEditTarget(client);
    setEditForm({
      name: client.name,
      slug: client.slug,
      primaryColor: client.primaryColor,
      active: client.active,
      logoUrl: client.logoUrl,
    });
    setSaveError("");
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm) return;
    const name = editForm.name.trim();
    const slug = editForm.slug.trim().toLowerCase();
    if (!name || !slug) {
      setSaveError(lt("Name and slug are required."));
      return;
    }
    const result = await updateClient(editTarget.id, {
      name,
      slug,
      primaryColor: editForm.primaryColor,
      active: editForm.active,
      logoUrl: editForm.logoUrl,
    });
    if (!result.ok) {
      setSaveError(result.error ?? lt("Could not save client."));
      return;
    }
    setEditTarget(null);
    setEditForm(null);
    setSaveError("");
  };

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-xs font-normal uppercase tracking-[0.12em] text-[var(--muted)]">{lt("CLIENTS")}</h2>
          <button type="button" onClick={openAdd} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {lt("Add Client")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-4 py-3 font-normal">{lt("Logo")}</th>
                <th className="px-4 py-3 font-normal">{lt("Client name")}</th>
                <th className="px-4 py-3 font-normal">{lt("Slug")}</th>
                <th className="px-4 py-3 font-normal">{lt("Status")}</th>
                <th className="px-4 py-3 font-normal">{lt("Users")}</th>
                <th className="px-4 py-3 text-right font-normal">{lt("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {clientsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                    {lt("Loading...")}
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                    {lt("No clients yet.")}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      {client.logoUrl ? (
                        <ClientLogo client={client} size="sm" />
                      ) : (
                        <span className="text-[10px] text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{client.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{client.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-normal uppercase tracking-[0.06em]",
                          client.active
                            ? "border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.12)] text-[rgba(134,239,172,0.95)]"
                            : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.45)]",
                        )}
                      >
                        {client.active ? lt("Active") : lt("Inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{userCountBySlug[client.slug] ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="btn-ghost rounded px-2 py-1 text-xs"
                        >
                          {lt("Edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddUserForClient(client.slug)}
                          className="btn-ghost rounded px-2 py-1 text-xs"
                        >
                          {lt("Add User")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={addOpen} title={lt("Add client")} onClose={() => setAddOpen(false)} closeLabel={lt("Close")}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Client name")}</label>
            <input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  slug: prev.slug === slugFromClientName(prev.name) || !prev.slug ? slugFromClientName(name) : prev.slug,
                }));
              }}
              className="w-full rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Slug")}</label>
            <input
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Primary color")}</label>
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
              className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-transparent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Logo (SVG)")}</label>
            <input
              type="file"
              accept="image/svg+xml,.svg"
              onChange={(e) =>
                void handleLogoFile(e.target.files?.[0], (logoUrl) => setForm((prev) => ({ ...prev, logoUrl })))
              }
              className="w-full text-xs text-[var(--muted)]"
            />
            {form.logoUrl ? (
              <div className="mt-2 flex items-center gap-2">
                <ClientLogo
                  client={{ name: form.name || "Client", logoUrl: form.logoUrl, primaryColor: form.primaryColor }}
                  size="md"
                />
                <button
                  type="button"
                  className="btn-ghost rounded px-2 py-1 text-xs"
                  onClick={() => setForm((prev) => ({ ...prev, logoUrl: null }))}
                >
                  {lt("Remove logo")}
                </button>
              </div>
            ) : null}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            {lt("Active")}
          </label>
          {saveError ? <p className="text-xs text-[#f87171]">{saveError}</p> : null}
          <button type="button" onClick={() => void saveAdd()} className="btn-primary w-full rounded-lg px-3 py-2 text-sm">
            {lt("Save")}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget && editForm)}
        title={lt("Edit client")}
        onClose={() => {
          setEditTarget(null);
          setEditForm(null);
        }}
        closeLabel={lt("Close")}
      >
        {editForm ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Client name")}</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Slug")}</label>
              <input
                value={editForm.slug}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Primary color")}</label>
              <input
                type="color"
                value={editForm.primaryColor}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, primaryColor: e.target.value } : prev))}
                className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-transparent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Logo (SVG)")}</label>
              <input
                type="file"
                accept="image/svg+xml,.svg"
                onChange={(e) =>
                  void handleLogoFile(e.target.files?.[0], (logoUrl) =>
                    setEditForm((prev) => (prev ? { ...prev, logoUrl } : prev)),
                  )
                }
                className="w-full text-xs text-[var(--muted)]"
              />
              {editForm.logoUrl ? (
                <div className="mt-2 flex items-center gap-2">
                  <ClientLogo
                    client={{
                      name: editForm.name || "Client",
                      logoUrl: editForm.logoUrl,
                      primaryColor: editForm.primaryColor,
                    }}
                    size="md"
                  />
                  <button
                    type="button"
                    className="btn-ghost rounded px-2 py-1 text-xs"
                    onClick={() => setEditForm((prev) => (prev ? { ...prev, logoUrl: null } : prev))}
                  >
                    {lt("Remove logo")}
                  </button>
                </div>
              ) : null}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))}
                className="rounded border-[var(--border)]"
              />
              {lt("Active")}
            </label>
            {saveError ? <p className="text-xs text-[#f87171]">{saveError}</p> : null}
            <button type="button" onClick={() => void saveEdit()} className="btn-primary w-full rounded-lg px-3 py-2 text-sm">
              {lt("Save")}
            </button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
