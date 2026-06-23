"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import {
  DEFAULT_CUSTOM_FUNNEL_STAGES,
  nextStageDotClass,
  type CreateCrmFunnelInput,
} from "@/lib/crm-funnels";
import { resolveCrmOwnerOptions } from "@/lib/crm-team-members";

type StageDraft = { name: string; dotClass: string };

export function CrmCreateFunnelModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (input: CreateCrmFunnelInput) => Promise<boolean>;
}) {
  const { dataClientSlug, users, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const clientUsers = useMemo(
    () => resolveCrmOwnerOptions(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );

  const [name, setName] = useState("");
  const [stages, setStages] = useState<StageDraft[]>(() =>
    DEFAULT_CUSTOM_FUNNEL_STAGES.map((s) => ({ ...s })),
  );
  const [accessUserIds, setAccessUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setName("");
    setStages(DEFAULT_CUSTOM_FUNNEL_STAGES.map((s) => ({ ...s })));
    setAccessUserIds([]);
    setError("");
  };

  const toggleUser = (userId: string) => {
    setAccessUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const addStage = () => {
    setStages((prev) => [...prev, { name: "", dotClass: nextStageDotClass(prev.length) }]);
  };

  const removeStage = (index: number) => {
    setStages((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const validStages = stages.map((s) => ({ name: s.name.trim(), dotClass: s.dotClass })).filter((s) => s.name);
    if (!trimmedName) {
      setError(lt("Funnel name is required."));
      return;
    }
    if (!validStages.length) {
      setError(lt("Add at least one stage."));
      return;
    }
    if (!accessUserIds.length) {
      setError(lt("Select at least one user with access."));
      return;
    }
    if (!dataClientSlug) {
      setError(lt("Select a client first."));
      return;
    }

    setSubmitting(true);
    setError("");
    const ok = await onCreated({
      clientSlug: dataClientSlug,
      name: trimmedName,
      stages: validStages,
      accessUserIds,
    });
    setSubmitting(false);
    if (ok) {
      reset();
      onClose();
    } else {
      setError(lt("Could not create funnel. Try again."));
    }
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">{lt("Add funnel")}</h3>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
          >
            {lt("Close")}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("Funnel name")}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              placeholder={lt("e.g. Partnerships")}
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                {lt("Stages")}
              </span>
              <button
                type="button"
                onClick={addStage}
                className="inline-flex items-center gap-1 text-xs text-[rgba(255,255,255,0.55)] hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {lt("Add stage")}
              </button>
            </div>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dotClass}`} aria-hidden />
                  <input
                    value={stage.name}
                    onChange={(e) =>
                      setStages((prev) => prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))
                    }
                    placeholder={lt("Stage name")}
                    className="min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeStage(index)}
                    disabled={stages.length <= 1}
                    className="rounded-md p-1.5 text-[rgba(255,255,255,0.4)] hover:text-[#f87171] disabled:opacity-30"
                    aria-label={lt("Remove stage")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("User access")}
            </span>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">{lt("Client admins always see all funnels and leads.")}</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-[8px] border border-[var(--border)] p-2">
              {clientUsers.length === 0 ? (
                <p className="text-xs text-[rgba(255,255,255,0.4)]">{lt("No client users found.")}</p>
              ) : (
                clientUsers.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-[rgba(255,255,255,0.04)]">
                    <input
                      type="checkbox"
                      checked={accessUserIds.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-sm text-white">{user.name}</span>
                    {user.email ? (
                      <span className="text-xs text-[rgba(255,255,255,0.35)]">{user.email}</span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
          </div>

          {error ? <p className="text-xs text-[#f87171]">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
          >
            {lt("Cancel")}
          </button>
          <button type="submit" disabled={submitting} className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
            {submitting ? lt("Saving…") : lt("Create funnel")}
          </button>
        </div>
      </form>
    </div>
  );
}
