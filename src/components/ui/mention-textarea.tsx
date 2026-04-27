"use client";

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { cn } from "@/lib/utils";

type MentionTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  mentionOptions: string[];
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

function getActiveMention(value: string, caret: number): MentionMatch | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const prev = at > 0 ? before[at - 1] : " ";
  if (!/\s|[([{]/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  return { start: at, end: caret, query };
}

export function MentionTextarea({
  value,
  onChange,
  mentionOptions,
  placeholder,
  className,
  rows = 3,
  disabled = false,
  onKeyDown,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mention = useMemo(() => {
    const el = ref.current;
    const caret = el ? el.selectionStart : value.length;
    return getActiveMention(value, caret);
  }, [value]);

  const options = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    const uniq = Array.from(new Set(mentionOptions.map((x) => x.trim()).filter(Boolean)));
    if (!q) return uniq.slice(0, 8);
    return uniq.filter((name) => name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, mentionOptions]);

  const applyMention = (name: string) => {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}@${name} ${value.slice(mention.end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = mention.start + name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (!options.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % options.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            applyMention(options[activeIndex] ?? options[0]);
          } else if (event.key === "Escape") {
            setActiveIndex(0);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
      />
      {options.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-[8px] border border-[var(--border)] bg-[#121212] p-1 shadow-lg">
          {options.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                applyMention(name);
              }}
              className={cn(
                "block w-full rounded-[6px] px-2 py-1.5 text-left text-xs font-light text-white transition-colors",
                idx === activeIndex ? "bg-[rgba(255,69,0,0.2)] text-[#ff8a66]" : "hover:bg-[rgba(255,255,255,0.06)]",
              )}
            >
              @{name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
