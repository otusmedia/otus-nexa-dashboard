"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "@/context/language-context";
import {
  nextProjectStatusDotClass,
  type ProjectBoardStatusDef,
} from "@/lib/project-board-statuses";

type StatusDraft = { name: string; dotClass: string };

export function EditProjectStatusesModal({
  open,
  statuses,
  onClose,
  onSave,
}: {
  open: boolean;
  statuses: ProjectBoardStatusDef[];
  onClose: () => void;
  onSave: (input: {
    statuses: Array<{ name: string; dotClass: string }>;
  }) => Promise<ProjectBoardStatusDef[] | null>;
}) {
  const { t: lt } = useLanguage();
  const [drafts, setDrafts] = useState<StatusDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDrafts(statuses.map((s) => ({ name: s.name, dotClass: s.dotClass })));
    setError("");
  }, [open, statuses]);

  if (!open) return null;

  const addStatus = () => {
    setDrafts((prev) => [...prev, { name: "", dotClass: nextProjectStatusDotClass(prev.length) }]);
  };

  const removeStatus = (index: number) => {
    setDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = drafts.map((s) => ({ name: s.name.trim(), dotClass: s.dotClass })).filter((s) => s.name);
    if (!valid.length) {
      setError(lt("Add at least one status."));
      return;
    }

    setSubmitting(true);
    setError("");
    const saved = await onSave({ statuses: valid });
    setSubmitting(false);
    if (saved) onClose();
    else setError(lt("Could not update statuses. Try again."));
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">{lt("Edit statuses")}</h3>
            <p className="mt-1 text-xs text-[rgba(255,255,255,0.4)]">
              {lt("Add, rename, or remove project board columns.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
          >
            {lt("Close")}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("Statuses")}
            </span>
            <button
              type="button"
              onClick={addStatus}
              className="inline-flex items-center gap-1 text-xs text-[rgba(255,255,255,0.55)] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {lt("Add status")}
            </button>
          </div>
          <p className="text-xs text-[rgba(255,255,255,0.4)]">
            {lt("Removed statuses move their projects to the first status.")}
          </p>
          <div className="space-y-2">
            {drafts.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dotClass}`} aria-hidden />
                <input
                  value={stage.name}
                  onChange={(e) =>
                    setDrafts((prev) => prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))
                  }
                  placeholder={lt("Status name")}
                  className="min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => removeStatus(index)}
                  disabled={drafts.length <= 1}
                  className="rounded-md p-1.5 text-[rgba(255,255,255,0.4)] hover:text-[#f87171] disabled:opacity-30"
                  aria-label={lt("Remove status")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {error ? <p className="text-xs text-[#f87171]">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs">
            {lt("Cancel")}
          </button>
          <button type="submit" disabled={submitting} className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
            {submitting ? lt("Saving…") : lt("Save changes")}
          </button>
        </div>
      </form>
    </div>
  );
}
