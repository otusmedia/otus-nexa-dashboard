"use client";

import { useEffect, useRef } from "react";
import { SidebarPanelContent, type SidebarPanelContentProps } from "@/components/layout/sidebar-panel-content";

type SidebarDrawerProps = Omit<SidebarPanelContentProps, "variant" | "onCollapse"> & {
  open: boolean;
  onClose: () => void;
};

export function SidebarDrawer({ open, onClose, ...panelProps }: SidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative flex h-full w-64 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] shadow-2xl"
      >
        <SidebarPanelContent {...panelProps} variant="drawer" onCloseDrawer={onClose} />
      </div>
    </div>
  );
}
