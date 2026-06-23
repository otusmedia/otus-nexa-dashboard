"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crmSourceLabel, crmT } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 pr-9 text-sm text-white outline-none";

function sourceMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function labelForSource(source: string, language: AppLanguage): string {
  return crmSourceLabel(source, language);
}

export function CrmSourceField({
  value,
  onChange,
  sourceOptions,
  language,
  hint,
  className,
  onCreateOption,
}: {
  value: string;
  onChange: (value: string) => void;
  sourceOptions: readonly string[];
  language: AppLanguage;
  hint?: string;
  className?: string;
  onCreateOption?: (source: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  const queryTrimmed = query.trim();

  const filteredOptions = useMemo(() => {
    const q = queryTrimmed.toLowerCase();
    return sourceOptions.filter((opt) => !q || opt.toLowerCase().includes(q));
  }, [sourceOptions, queryTrimmed]);

  const canCreate =
    queryTrimmed.length > 0 && !sourceOptions.some((opt) => sourceMatches(queryTrimmed, opt));

  const dropdownItems = useMemo(() => {
    const items: Array<{ type: "option"; value: string } | { type: "create"; value: string }> =
      filteredOptions.map((opt) => ({ type: "option", value: opt }));

    const trimmedValue = value.trim();
    if (
      trimmedValue &&
      !sourceOptions.some((opt) => sourceMatches(trimmedValue, opt)) &&
      (!queryTrimmed || trimmedValue.toLowerCase().includes(queryTrimmed.toLowerCase())) &&
      !items.some((item) => sourceMatches(item.value, trimmedValue))
    ) {
      items.unshift({ type: "option", value: trimmedValue });
    }

    if (canCreate) {
      items.push({ type: "create", value: queryTrimmed });
    }

    return items;
  }, [filteredOptions, canCreate, queryTrimmed, sourceOptions, value]);

  const updateMenuRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    updateMenuRect();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById(menuId);
        if (menu?.contains(event.target as Node)) return;
        setOpen(false);
        setQuery("");
      }
    };

    const onReposition = () => updateMenuRect();

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, menuId]);

  const commit = async (next: string, isNew: boolean) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    onChange(trimmed);
    if (isNew) await onCreateOption?.(trimmed);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const openField = () => {
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => {
      updateMenuRect();
      inputRef.current?.focus();
    });
  };

  const displayValue = open
    ? query
    : value
      ? labelForSource(value, language)
      : "";

  const menu =
    open && dropdownItems.length > 0 && menuRect
      ? createPortal(
          <div
            id={menuId}
            role="listbox"
            style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
            className="fixed z-[200] max-h-48 overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[#121212] p-1 shadow-lg"
          >
            {dropdownItems.map((item, index) => (
              <button
                key={`${item.type}-${item.value}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void commit(item.value, item.type === "create");
                }}
                className={cn(
                  "block w-full rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white transition-colors",
                  index === activeIndex
                    ? "bg-[rgba(255,69,0,0.2)] text-[#ff8a66]"
                    : "hover:bg-[rgba(255,255,255,0.06)]",
                )}
              >
                {item.type === "create"
                  ? crmT('Add source "{name}"', language).replace("{name}", item.value)
                  : labelForSource(item.value, language)}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        readOnly={!open}
        value={displayValue}
        onFocus={openField}
        onClick={() => {
          if (!open) openField();
        }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!dropdownItems.length) return;
            setActiveIndex((prev) => (prev + 1) % dropdownItems.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!dropdownItems.length) return;
            setActiveIndex((prev) => (prev - 1 + dropdownItems.length) % dropdownItems.length);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const item = dropdownItems[activeIndex];
            if (item) {
              void commit(item.value, item.type === "create");
            } else if (queryTrimmed) {
              void commit(queryTrimmed, canCreate);
            }
          }
        }}
        placeholder={!value ? hint : undefined}
        className={cn(fieldClass, !open && "cursor-pointer")}
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(255,255,255,0.45)]"
        aria-hidden
      />
      {menu}
    </div>
  );
}
