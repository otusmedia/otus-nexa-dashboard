"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showLabel?: string;
  hideLabel?: string;
  toggleClassName?: string;
};

export function PasswordInput({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  toggleClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(className, "pr-11")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] transition hover:text-[var(--text)]",
          toggleClassName,
        )}
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}
