"use client";

export function DeleteConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div
        className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <p id="delete-confirm-title" className="section-title">
          {title}
        </p>
        <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs font-light">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[8px] bg-[#ef4444] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#dc2626]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
