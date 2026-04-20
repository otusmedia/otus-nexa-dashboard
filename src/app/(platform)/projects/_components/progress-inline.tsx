"use client";

export function ProgressInline({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="h-[2px] min-w-[48px] flex-1 rounded-[2px] bg-[rgba(255,255,255,0.08)]">
        <div className="h-[2px] rounded-[2px] bg-[#379136]" style={{ width: `${pct}%` }} />
      </div>
      <span className="metric-value shrink-0 text-xs font-light tabular-nums text-white">{pct}%</span>
    </div>
  );
}
