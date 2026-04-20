export function Modal({
  open,
  title,
  onClose,
  closeLabel = "Close",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-normal text-[var(--text)]">{title}</h3>
          <button className="btn-ghost rounded-lg px-2 py-1 text-xs" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
