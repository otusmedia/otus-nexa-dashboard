"use client";

import { Draggable, Droppable } from "@hello-pangea/dnd";
import type { CrmLead, CrmLeadStatus } from "@/lib/crm-data";
import { CrmPipelineCard } from "@/modules/crm/crm-pipeline-card";

export function CrmPipelineColumn({
  columnId,
  label,
  dotClass,
  leads,
  onAddLead,
  onOpenLead,
}: {
  columnId: CrmLeadStatus;
  label: string;
  dotClass: string;
  leads: CrmLead[];
  onAddLead: (columnId: CrmLeadStatus) => void;
  onOpenLead: (lead: CrmLead) => void;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2 px-0.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
          {label}
        </h2>
      </div>
      <Droppable droppableId={columnId}>
        {(dropProvided, dropSnapshot) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-1 transition-colors"
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={dropSnapshot.isDraggingOver ? "rounded-[8px] border border-[#ff4500]/20 p-0.5" : ""}
                  >
                    <CrmPipelineCard
                      lead={lead}
                      isDragging={dragSnapshot.isDragging}
                      onOpen={onOpenLead}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
      <button
        type="button"
        onClick={() => onAddLead(columnId)}
        className="mt-2 shrink-0 rounded-[8px] border border-dashed border-[var(--border-strong)] bg-transparent py-2.5 text-xs font-normal text-[rgba(255,255,255,0.4)] transition-colors hover:border-[var(--border)] hover:text-[var(--muted)]"
      >
        Add New Lead
      </button>
    </div>
  );
}
