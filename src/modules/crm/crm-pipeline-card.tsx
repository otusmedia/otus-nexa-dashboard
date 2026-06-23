"use client";

import { useLanguage } from "@/context/language-context";
import {
  formatLeadCreatedAt,
  formatLeadValue,
  leadClosedValue,
  leadProposalValue,
  normalizeSource,
  type CrmLead,
} from "@/lib/crm-data";
import { crmSourceLabel } from "@/lib/crm-i18n";
import { cn } from "@/lib/utils";
import { OwnerAvatars } from "@/app/(platform)/projects/_components/owner-avatars";

export function CrmPipelineCard({
  lead,
  isDragging,
  onOpen,
}: {
  lead: CrmLead;
  isDragging?: boolean;
  onOpen: (lead: CrmLead) => void;
}) {
  const { language, t: lt } = useLanguage();
  const owner = lead.owner?.trim() || "";
  const owners = owner ? [owner] : [];
  const sourceKey = normalizeSource(lead.source, lead.client_slug);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-[8px] border border-[var(--border)] bg-[#161616] p-3 text-left transition-colors hover:border-[var(--border-strong)]",
        isDragging && "border-[#ff4500]/40 opacity-90",
      )}
    >
      <p className="pr-1 text-sm font-normal leading-snug text-white">{lead.name}</p>
      {lead.company?.trim() ? (
        <p className="mt-1 truncate text-xs font-light text-[rgba(255,255,255,0.45)]">{lead.company}</p>
      ) : null}
      <div className="mt-2">
        <OwnerAvatars names={owners} />
      </div>
      <p className="mono-num mt-2 text-xs font-medium text-[#ff4500]">{formatLeadValue(leadProposalValue(lead))}</p>
      {leadClosedValue(lead) > 0 ? (
        <p className="mono-num text-[0.65rem] text-[rgba(255,255,255,0.45)]">
          {formatLeadValue(leadClosedValue(lead))} {lt("closed")}
        </p>
      ) : null}
      <p className="mt-1 text-xs font-light text-[rgba(255,255,255,0.4)]">
        {formatLeadCreatedAt(lead.created_at)}
      </p>
      <span className="mt-2 inline-block rounded-md border border-[rgba(255,69,0,0.35)] bg-[rgba(255,69,0,0.1)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[#ff9a66]">
        {crmSourceLabel(sourceKey, language)}
      </span>
    </div>
  );
}
