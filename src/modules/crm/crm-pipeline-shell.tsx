"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { useAppContext } from "@/components/providers/app-providers";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { funnelPipelinePath, type CrmFunnelDef } from "@/lib/crm-funnels";
import { cn } from "@/lib/utils";
import { CrmCreateFunnelModal } from "@/modules/crm/crm-create-funnel-modal";
import { CrmEditFunnelModal } from "@/modules/crm/crm-edit-funnel-modal";
import {
  createCrmFunnel,
  deleteCrmFunnel,
  notifyCrmFunnelsReload,
  updateCrmFunnelDef,
  useCrmFunnels,
} from "@/modules/crm/use-crm-funnels";

function funnelTabLabel(name: string, lt: (key: string) => string): string {
  if (name === "Sales") return lt("Sales");
  if (name === "Resumes") return lt("Resumes");
  return name;
}

type FunnelContextMenu = {
  x: number;
  y: number;
  funnel: CrmFunnelDef;
};

export function CrmPipelineShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dataClientSlug } = useAppContext();
  const { t: lt } = useLanguage();
  const { funnels, reload, canManageFunnels } = useCrmFunnels();
  const [createOpen, setCreateOpen] = useState(false);
  const [editFunnel, setEditFunnel] = useState<CrmFunnelDef | null>(null);
  const [deleteFunnel, setDeleteFunnel] = useState<CrmFunnelDef | null>(null);
  const [contextMenu, setContextMenu] = useState<FunnelContextMenu | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu, closeContextMenu]);

  const handleCreated = async (input: Parameters<typeof createCrmFunnel>[0]) => {
    const created = await createCrmFunnel(input);
    if (created) {
      await reload();
      notifyCrmFunnelsReload();
      router.push(funnelPipelinePath(created.slug));
      return true;
    }
    return false;
  };

  const handleUpdated = async (input: {
    name: string;
    stages: Array<{ name: string; dotClass: string }>;
    accessUserIds: string[];
  }) => {
    if (!editFunnel || !dataClientSlug) return null;
    const updated = await updateCrmFunnelDef(editFunnel, dataClientSlug, input);
    if (updated) {
      await reload();
      notifyCrmFunnelsReload();
      setEditFunnel(updated);
    }
    return updated;
  };

  const handleDeleted = async () => {
    if (!deleteFunnel?.id || !dataClientSlug) return false;
    const result = await deleteCrmFunnel(deleteFunnel.id, dataClientSlug);
    if (result.ok) {
      await reload();
      notifyCrmFunnelsReload();
      if (pathname === funnelPipelinePath(deleteFunnel.slug)) {
        router.push("/crm/pipeline");
      }
      setDeleteFunnel(null);
      return true;
    }
    return false;
  };

  const openTabContextMenu = (event: React.MouseEvent, funnel: CrmFunnelDef) => {
    if (!canManageFunnels) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, funnel });
  };

  return (
    <div className="w-full min-w-0">
      <PageHeader title={lt("Pipeline")} subtitle={lt("Kanban pipeline")} />
      <nav
        className="mb-4 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[8px] border border-[var(--border)] p-1"
        aria-label={lt("Pipeline")}
      >
        {funnels.map((funnel) => {
          const href = funnelPipelinePath(funnel.slug);
          const active = pathname === href;
          return (
            <Link
              key={funnel.slug}
              href={href}
              onContextMenu={(event) => openTabContextMenu(event, funnel)}
              className={cn(
                "rounded-[6px] px-3 py-1.5 text-xs transition-colors",
                active
                  ? "bg-[rgba(255,69,0,0.15)] text-[rgba(255,69,0,1)]"
                  : "text-[rgba(255,255,255,0.45)] hover:text-white",
              )}
            >
              {funnelTabLabel(funnel.name, lt)}
            </Link>
          );
        })}
        {canManageFunnels ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs text-[rgba(255,255,255,0.45)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            title={lt("Add funnel")}
            aria-label={lt("Add funnel")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </nav>
      {children}
      <CrmCreateFunnelModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      {editFunnel ? (
        <CrmEditFunnelModal
          open
          funnel={editFunnel}
          allowDelete={!editFunnel.isBuiltin}
          onClose={() => setEditFunnel(null)}
          onUpdated={handleUpdated}
          onDeleted={async () => {
            if (editFunnel) setDeleteFunnel(editFunnel);
            setEditFunnel(null);
            return true;
          }}
        />
      ) : null}
      <DeleteConfirmModal
        open={Boolean(deleteFunnel)}
        title={lt("Delete funnel")}
        message={lt("Delete funnel confirm message")}
        confirmLabel={lt("Delete funnel")}
        cancelLabel={lt("Cancel")}
        onConfirm={() => void handleDeleted()}
        onCancel={() => setDeleteFunnel(null)}
      />
      {contextMenu && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label={lt("Close")}
                className="fixed inset-0 z-[140] cursor-default bg-transparent"
                onClick={closeContextMenu}
              />
              <div
                className="fixed z-[141] min-w-[168px] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#161616] py-1 shadow-lg"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.06)]"
                  onClick={() => {
                    setEditFunnel(contextMenu.funnel);
                    closeContextMenu();
                  }}
                >
                  {lt("Edit funnel")}
                </button>
                {!contextMenu.funnel.isBuiltin ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-xs text-[#f87171] hover:bg-[rgba(248,113,113,0.08)]"
                    onClick={() => {
                      setDeleteFunnel(contextMenu.funnel);
                      closeContextMenu();
                    }}
                  >
                    {lt("Delete funnel")}
                  </button>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
