"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { ClientLogo } from "@/components/ui/client-logo";
import { slugFromClientName } from "@/lib/client-utils";
import { EMPTY_CLIENT_APIS } from "@/lib/client-apis";
import { EMPTY_CLIENT_API_CREDENTIALS } from "@/lib/client-api-credentials";
import { EMPTY_CLIENT_CRM_INTEGRATION } from "@/lib/client-crm-integration";
import { EMPTY_CLIENT_WHATSAPP_CONFIG } from "@/lib/client-whatsapp-config";
import { DEFAULT_CLIENT_DASHBOARD_CARDS, type ClientDashboardCards } from "@/lib/client-dashboard-cards";
import { ClientCrmFeaturesFields } from "@/modules/settings/client-crm-features-fields";
import { ClientCrmIntegrationFields } from "@/modules/settings/client-crm-integration-fields";
import { ClientWhatsAppFields } from "@/modules/settings/client-whatsapp-fields";
import { GhlImportPanel } from "@/modules/settings/ghl-import-panel";
import { uploadClientHeroImage } from "@/lib/client-hero-upload";
import { readSvgFileAsDataUrl } from "@/lib/client-logo-upload";
import { ClientApisFields } from "@/modules/settings/client-form-fields";
import { ClientDashboardCardsFields } from "@/modules/settings/client-dashboard-cards-fields";
import { ClientEnabledModulesFields } from "@/modules/settings/client-enabled-modules-fields";
import type { AppLanguage, Client, ClientApiCredentials, ClientApisConfig, ClientCrmIntegration, ClientWhatsAppConfig, ModuleKey } from "@/types";
import { cn } from "@/lib/utils";

type ClientFormState = {
  name: string;
  slug: string;
  primaryColor: string;
  active: boolean;
  logoUrl: string | null;
  logoLightUrl: string | null;
  heroImageUrl: string | null;
  apis: ClientApisConfig;
  apiCredentials: ClientApiCredentials;
  crmIntegration: ClientCrmIntegration;
  whatsappConfig: ClientWhatsAppConfig;
  dashboardCards: ClientDashboardCards;
  defaultLocale: AppLanguage;
  enabledModules: ModuleKey[];
};

function emptyClientForm(): ClientFormState {
  return {
    name: "",
    slug: "",
    primaryColor: "#FF4500",
    active: true,
    logoUrl: null,
    logoLightUrl: null,
    heroImageUrl: null,
    apis: { ...EMPTY_CLIENT_APIS },
    apiCredentials: { ...EMPTY_CLIENT_API_CREDENTIALS },
    crmIntegration: { ...EMPTY_CLIENT_CRM_INTEGRATION },
    whatsappConfig: { ...EMPTY_CLIENT_WHATSAPP_CONFIG },
    dashboardCards: { ...DEFAULT_CLIENT_DASHBOARD_CARDS },
    defaultLocale: "en",
    enabledModules: [],
  };
}

function ClientLogoThemeFields({
  name,
  primaryColor,
  logoUrl,
  logoLightUrl,
  onLogoChange,
  onLogoLightChange,
  onPickFile,
  lt,
}: {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  logoLightUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onLogoLightChange: (url: string | null) => void;
  onPickFile: (file: File | undefined, apply: (url: string | null) => void) => void;
  lt: (key: string) => string;
}) {
  const previewClient = {
    name: name || "Client",
    logoUrl,
    logoLightUrl,
    primaryColor,
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Logo (dark theme)")}</label>
        <p className="mb-1.5 text-[0.7rem] text-[var(--muted)]">
          {lt("SVG for dark backgrounds (typically a light mark).")}
        </p>
        <input
          type="file"
          accept="image/svg+xml,.svg"
          onChange={(e) => void onPickFile(e.target.files?.[0], onLogoChange)}
          className="w-full text-xs text-[var(--muted)]"
        />
        {logoUrl ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[#111111] px-3 py-2">
            <ClientLogo client={previewClient} size="sidebar" theme="dark" />
            <button type="button" className="btn-ghost rounded px-2 py-1 text-xs" onClick={() => onLogoChange(null)}>
              {lt("Remove dark logo")}
            </button>
          </div>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Logo (light theme)")}</label>
        <p className="mb-1.5 text-[0.7rem] text-[var(--muted)]">
          {lt("SVG for light backgrounds (typically a dark mark).")}
        </p>
        <input
          type="file"
          accept="image/svg+xml,.svg"
          onChange={(e) => void onPickFile(e.target.files?.[0], onLogoLightChange)}
          className="w-full text-xs text-[var(--muted)]"
        />
        {logoLightUrl ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[#f4f4f5] px-3 py-2">
            <ClientLogo client={previewClient} size="sidebar" theme="light" />
            <button
              type="button"
              className="btn-ghost rounded px-2 py-1 text-xs"
              onClick={() => onLogoLightChange(null)}
            >
              {lt("Remove light logo")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
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

  const handleHeroFile = async (
    slug: string,
    file: File | undefined,
    apply: (url: string | null) => void,
  ) => {
    if (!file) return;
    const { url, error } = await uploadClientHeroImage(slug, file);
    if (!url) {
      setSaveError(error ?? lt("Could not upload hero image."));
      return;
    }
    setSaveError("");
    apply(url);
  };

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
      logoLightUrl: form.logoLightUrl,
      heroImageUrl: form.heroImageUrl,
      apis: form.apis,
      apiCredentials: form.apiCredentials,
      crmIntegration: form.crmIntegration,
      whatsappConfig: form.whatsappConfig,
      dashboardCards: form.dashboardCards,
      defaultLocale: form.defaultLocale,
      enabledModules: form.enabledModules.length > 0 ? form.enabledModules : null,
    });
    if (!result.ok) {
      setSaveError(lt(result.error ?? "Could not save client."));
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
      logoLightUrl: client.logoLightUrl,
      heroImageUrl: client.heroImageUrl,
      apis: { ...client.apis },
      apiCredentials: { ...client.apiCredentials },
      crmIntegration: { ...client.crmIntegration },
      whatsappConfig: { ...client.whatsappConfig },
      dashboardCards: { ...client.dashboardCards },
      defaultLocale: client.defaultLocale,
      enabledModules: client.enabledModules ? [...client.enabledModules] : [],
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
      logoLightUrl: editForm.logoLightUrl,
      heroImageUrl: editForm.heroImageUrl,
      apis: editForm.apis,
      apiCredentials: editForm.apiCredentials,
      crmIntegration: editForm.crmIntegration,
      whatsappConfig: editForm.whatsappConfig,
      dashboardCards: editForm.dashboardCards,
      defaultLocale: editForm.defaultLocale,
      enabledModules: editForm.enabledModules.length > 0 ? editForm.enabledModules : null,
    });
    if (!result.ok) {
      setSaveError(lt(result.error ?? "Could not save client."));
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
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Matrix language")}</label>
            <p className="mb-1 text-[0.7rem] text-[var(--muted)]">{lt("Default UI language for this client")}</p>
            <select
              value={form.defaultLocale}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, defaultLocale: e.target.value as AppLanguage }))
              }
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="en">{lt("English")}</option>
              <option value="pt-BR">{lt("Portuguese (Brazil)")}</option>
            </select>
          </div>
          <ClientLogoThemeFields
            name={form.name}
            primaryColor={form.primaryColor}
            logoUrl={form.logoUrl}
            logoLightUrl={form.logoLightUrl}
            onLogoChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))}
            onLogoLightChange={(logoLightUrl) => setForm((prev) => ({ ...prev, logoLightUrl }))}
            onPickFile={(file, apply) => void handleLogoFile(file, apply)}
            lt={lt}
          />
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Hero background")}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(e) =>
                void handleHeroFile(form.slug || slugFromClientName(form.name), e.target.files?.[0], (heroImageUrl) =>
                  setForm((prev) => ({ ...prev, heroImageUrl })),
                )
              }
              className="w-full text-xs text-[var(--muted)]"
            />
            {form.heroImageUrl ? (
              <div className="mt-2 space-y-2">
                <img
                  src={form.heroImageUrl}
                  alt=""
                  className="h-20 w-full max-w-xs rounded-lg object-cover"
                />
                <button
                  type="button"
                  className="btn-ghost rounded px-2 py-1 text-xs"
                  onClick={() => setForm((prev) => ({ ...prev, heroImageUrl: null }))}
                >
                  {lt("Remove hero image")}
                </button>
              </div>
            ) : null}
          </div>
          <ClientEnabledModulesFields
            value={form.enabledModules}
            onChange={(enabledModules) => setForm((prev) => ({ ...prev, enabledModules }))}
          />
          <ClientDashboardCardsFields
            value={form.dashboardCards}
            onChange={(dashboardCards) => setForm((prev) => ({ ...prev, dashboardCards }))}
          />
          <ClientCrmFeaturesFields
            value={form.crmIntegration}
            onChange={(crmIntegration) => setForm((prev) => ({ ...prev, crmIntegration }))}
            lt={lt}
          />
          <ClientApisFields
            value={form.apis}
            onChange={(apis) => setForm((prev) => ({ ...prev, apis }))}
            apiCredentials={form.apiCredentials}
            onCredentialsChange={(apiCredentials) => setForm((prev) => ({ ...prev, apiCredentials }))}
            lt={lt}
          />
          <ClientCrmIntegrationFields
            value={form.crmIntegration}
            onChange={(crmIntegration) => setForm((prev) => ({ ...prev, crmIntegration }))}
            clientSlug={form.slug || slugFromClientName(form.name)}
            lt={lt}
          />
          <ClientWhatsAppFields
            value={form.whatsappConfig}
            onChange={(whatsappConfig) => setForm((prev) => ({ ...prev, whatsappConfig }))}
            clientName={form.name}
            lt={lt}
          />
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
            <ClientLogoThemeFields
              name={editForm.name}
              primaryColor={editForm.primaryColor}
              logoUrl={editForm.logoUrl}
              logoLightUrl={editForm.logoLightUrl}
              onLogoChange={(logoUrl) => setEditForm((prev) => (prev ? { ...prev, logoUrl } : prev))}
              onLogoLightChange={(logoLightUrl) =>
                setEditForm((prev) => (prev ? { ...prev, logoLightUrl } : prev))
              }
              onPickFile={(file, apply) => void handleLogoFile(file, apply)}
              lt={lt}
            />
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Hero background")}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={(e) =>
                  void handleHeroFile(editForm.slug, e.target.files?.[0], (heroImageUrl) =>
                    setEditForm((prev) => (prev ? { ...prev, heroImageUrl } : prev)),
                  )
                }
                className="w-full text-xs text-[var(--muted)]"
              />
              {editForm.heroImageUrl ? (
                <div className="mt-2 space-y-2">
                  <img src={editForm.heroImageUrl} alt="" className="h-20 w-full max-w-xs rounded-lg object-cover" />
                  <button
                    type="button"
                    className="btn-ghost rounded px-2 py-1 text-xs"
                    onClick={() => setEditForm((prev) => (prev ? { ...prev, heroImageUrl: null } : prev))}
                  >
                    {lt("Remove hero image")}
                  </button>
                </div>
              ) : null}
            </div>
            <ClientEnabledModulesFields
              value={editForm.enabledModules}
              onChange={(enabledModules) => setEditForm((prev) => (prev ? { ...prev, enabledModules } : prev))}
            />
            <ClientDashboardCardsFields
              value={editForm.dashboardCards}
              onChange={(dashboardCards) => setEditForm((prev) => (prev ? { ...prev, dashboardCards } : prev))}
            />
            <ClientCrmFeaturesFields
              value={editForm.crmIntegration}
              onChange={(crmIntegration) => setEditForm((prev) => (prev ? { ...prev, crmIntegration } : prev))}
              lt={lt}
            />
            <ClientApisFields
              value={editForm.apis}
              onChange={(apis) => setEditForm((prev) => (prev ? { ...prev, apis } : prev))}
              apiCredentials={editForm.apiCredentials}
              onCredentialsChange={(apiCredentials) =>
                setEditForm((prev) => (prev ? { ...prev, apiCredentials } : prev))
              }
              lt={lt}
            />
            <ClientCrmIntegrationFields
              value={editForm.crmIntegration}
              onChange={(crmIntegration) => setEditForm((prev) => (prev ? { ...prev, crmIntegration } : prev))}
              clientSlug={editForm.slug}
              lt={lt}
            />
            <ClientWhatsAppFields
              value={editForm.whatsappConfig}
              onChange={(whatsappConfig) => setEditForm((prev) => (prev ? { ...prev, whatsappConfig } : prev))}
              clientName={editForm.name}
              lt={lt}
            />
            {editForm.slug.trim() ? <GhlImportPanel clientSlug={editForm.slug.trim()} /> : null}
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Matrix language")}</label>
              <p className="mb-1 text-[0.7rem] text-[var(--muted)]">{lt("Default UI language for this client")}</p>
              <select
                value={editForm.defaultLocale}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev ? { ...prev, defaultLocale: e.target.value as AppLanguage } : prev,
                  )
                }
                className="w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="en">{lt("English")}</option>
                <option value="pt-BR">{lt("Portuguese (Brazil)")}</option>
              </select>
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
