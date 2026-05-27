"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableRubric,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import type { ModuleKey } from "@/types";
import { cn } from "@/lib/utils";

export type SidebarNavLink = {
  key: ModuleKey;
  labelKey:
    | "dashboard"
    | "projects"
    | "financial"
    | "updates"
    | "marketing"
    | "content-management"
    | "calendar"
    | "crm"
    | "files"
    | "contracts";
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

type SidebarNavProps = {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  links: SidebarNavLink[];
  pathname: string;
  t: (key: SidebarNavLink["labelKey"]) => string;
  lt: (key: string) => string;
  dragLabel: string;
  showUpdatesUnreadDot: boolean;
  marketingMenuOpen: boolean;
  setMarketingMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contentMenuOpen: boolean;
  setContentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  crmMenuOpen: boolean;
  setCrmMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onReorder: (order: ModuleKey[]) => void;
};

type SidebarNavItemRowProps = Omit<SidebarNavProps, "links" | "onReorder" | "scrollContainerRef"> & {
  link: SidebarNavLink;
  dragProvided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
};

function SidebarNavItemRow({
  link,
  dragProvided,
  snapshot,
  dragLabel,
  ...navProps
}: SidebarNavItemRowProps) {
  const isStudioModule = link.key === "content-management";
  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      className={cn(
        "group/nav rounded-lg",
        isStudioModule && "sidebar-nav-studio-row",
        snapshot.isDragging && "bg-[var(--surface-elevated)] shadow-md ring-1 ring-[var(--border)]",
      )}
    >
      <div className="flex items-start gap-0.5">
        <button
          type="button"
          {...dragProvided.dragHandleProps}
          className={cn(
            "mt-1.5 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[rgba(255,255,255,0.2)] transition",
            "opacity-0 group-hover/nav:opacity-100 hover:text-[rgba(255,255,255,0.55)] active:cursor-grabbing",
            snapshot.isDragging && "opacity-100",
          )}
          aria-label={dragLabel}
          tabIndex={0}
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <div className={cn("min-w-0 flex-1 pr-1", isStudioModule && "min-h-[2.5rem]")}>
          <NavItemContent link={link} {...navProps} />
        </div>
      </div>
    </div>
  );
}

function isLinkActive(link: SidebarNavLink, pathname: string): boolean {
  if (link.key === "projects") return pathname.startsWith("/projects");
  if (link.key === "updates") return pathname.startsWith("/updates");
  if (link.key === "calendar") return pathname.startsWith("/calendar");
  if (link.key === "marketing") return pathname.startsWith("/marketing");
  if (link.key === "content-management") return pathname.startsWith("/content-management");
  if (link.key === "crm") return pathname.startsWith("/crm");
  return pathname === link.href;
}

function NavItemContent({
  link,
  pathname,
  t,
  showUpdatesUnreadDot,
  marketingMenuOpen,
  setMarketingMenuOpen,
  contentMenuOpen,
  setContentMenuOpen,
  crmMenuOpen,
  setCrmMenuOpen,
  lt,
}: Omit<SidebarNavProps, "links" | "onReorder" | "dragLabel" | "scrollContainerRef"> & { link: SidebarNavLink }) {
  const isActive = isLinkActive(link, pathname);
  const Icon = link.icon;

  if (link.key === "marketing") {
    const submenuItems = [
      { labelKey: "Strategy", href: "/marketing/strategy" },
      { labelKey: "Campaigns", href: "/marketing/campaigns" },
      { labelKey: "Reports", href: "/marketing/reports" },
    ] as const;
    return (
      <>
        <button
          type="button"
          onClick={() => setMarketingMenuOpen((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
            isActive
              ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
              : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t(link.labelKey)}
        </button>
        {marketingMenuOpen ? (
          <div className="mt-1 space-y-1 pl-7">
            {submenuItems.map((item) => {
              const subActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg border-l-2 border-transparent px-3 py-1.5 text-xs transition [border-image:none]",
                    subActive
                      ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                      : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                  )}
                >
                  {lt(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  if (link.key === "content-management") {
    const contentSubmenuItems = [
      { labelKey: "AI Studio", href: "/content-management/ai-studio" },
      { labelKey: "Compose", href: "/content-management/compose" },
    ] as const;
    return (
      <>
        <button
          type="button"
          onClick={() => setContentMenuOpen((prev) => !prev)}
          className={cn(
            "sidebar-nav-studio flex h-full min-h-[2.5rem] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm [border-image:none]",
            isActive ? "sidebar-nav-studio--active" : "text-[rgba(255,255,255,0.4)]",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t(link.labelKey)}
        </button>
        {contentMenuOpen ? (
          <div className="mt-1 space-y-1 pl-7">
            {contentSubmenuItems.map((item) => {
              const subActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "sidebar-nav-studio-sub flex items-center rounded-lg px-3 py-1.5 text-xs [border-image:none]",
                    subActive
                      ? "sidebar-nav-studio-sub--active"
                      : "text-[rgba(255,255,255,0.4)]",
                  )}
                >
                  {lt(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  if (link.key === "crm") {
    const crmSubmenuItems = [
      { labelKey: "Dashboard", href: "/crm/dashboard" },
      { labelKey: "Pipeline", href: "/crm/pipeline" },
      { labelKey: "Contacts", href: "/crm/contacts" },
      { labelKey: "Reports", href: "/crm/reports" },
    ] as const;
    return (
      <>
        <button
          type="button"
          onClick={() => setCrmMenuOpen((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
            isActive
              ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
              : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t(link.labelKey)}
        </button>
        {crmMenuOpen ? (
          <div className="mt-1 space-y-1 pl-7">
            {crmSubmenuItems.map((item) => {
              const subActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg border-l-2 border-transparent px-3 py-1.5 text-xs transition [border-image:none]",
                    subActive
                      ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                      : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                  )}
                >
                  {lt(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
        link.key === "updates" && "relative",
        isActive
          ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
          : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {t(link.labelKey)}
      {link.key === "updates" && showUpdatesUnreadDot ? (
        <span
          className="pointer-events-none absolute right-2 top-2 h-2 w-2 shrink-0 rounded-full bg-[#FF4500]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

const SIDEBAR_NAV_DRAGGING_CLASS = "sidebar-nav-dragging";

export function SidebarNav(props: SidebarNavProps) {
  const { links, onReorder, dragLabel, scrollContainerRef } = props;

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove(SIDEBAR_NAV_DRAGGING_CLASS);
    };
  }, []);

  const applyReorder = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...links];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onReorder(next.map((l) => l.key));
  };

  const onDragStart = () => {
    document.documentElement.classList.add(SIDEBAR_NAV_DRAGGING_CLASS);
  };

  const onDragEnd = (result: DropResult) => {
    document.documentElement.classList.remove(SIDEBAR_NAV_DRAGGING_CLASS);
    applyReorder(result);
  };

  const rowProps = {
    pathname: props.pathname,
    t: props.t,
    lt: props.lt,
    dragLabel,
    showUpdatesUnreadDot: props.showUpdatesUnreadDot,
    marketingMenuOpen: props.marketingMenuOpen,
    setMarketingMenuOpen: props.setMarketingMenuOpen,
    contentMenuOpen: props.contentMenuOpen,
    setContentMenuOpen: props.setContentMenuOpen,
    crmMenuOpen: props.crmMenuOpen,
    setCrmMenuOpen: props.setCrmMenuOpen,
  };

  const renderClone = (
    dragProvided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric,
  ) => {
    const link = links[rubric.source.index];
    if (!link) return null;
    return <SidebarNavItemRow link={link} dragProvided={dragProvided} snapshot={snapshot} {...rowProps} />;
  };

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Droppable
        droppableId="sidebar-main-nav"
        renderClone={renderClone}
        getContainerForClone={() => scrollContainerRef.current ?? document.body}
      >
        {(dropProvided) => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-1">
            {links.map((link, index) => (
              <Draggable key={link.key} draggableId={link.key} index={index}>
                {(dragProvided, snapshot) => (
                  <SidebarNavItemRow
                    link={link}
                    dragProvided={dragProvided}
                    snapshot={snapshot}
                    {...rowProps}
                  />
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
