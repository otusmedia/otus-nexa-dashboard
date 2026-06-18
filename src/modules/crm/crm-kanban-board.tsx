"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext } from "@hello-pangea/dnd";
import { useLanguage } from "@/context/language-context";
import type { CrmLead } from "@/lib/crm-data";
import { CrmPipelineColumn } from "@/modules/crm/crm-pipeline-column";

export type CrmKanbanColumnDef = {
  id: string;
  label: string;
  dotClass: string;
};

export function CrmKanbanBoard({
  columns,
  leadsByColumn,
  loading,
  leadCount,
  onDragEnd,
  onOpenLead,
  onAddLead,
  addLeadLabel,
}: {
  columns: CrmKanbanColumnDef[];
  leadsByColumn: Record<string, CrmLead[]>;
  loading: boolean;
  leadCount: number;
  onDragEnd: (result: DropResult) => void | Promise<void>;
  onOpenLead: (lead: CrmLead) => void;
  onAddLead?: (columnId: string) => void;
  addLeadLabel?: string;
}) {
  const { t: lt } = useLanguage();

  if (loading && leadCount === 0) {
    return <p className="text-sm text-[rgba(255,255,255,0.45)]">{lt("Loading pipeline…")}</p>;
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mb-3 px-1 text-xs font-light text-[rgba(255,255,255,0.4)]">
          {leadCount} {lt("leads")}
        </div>
        <div className="h-[80vh] w-max overflow-hidden">
          <div className="flex h-full min-h-0 w-max flex-row gap-4 px-1 pb-4">
            {columns.map((col) => (
              <CrmPipelineColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                addLeadLabel={addLeadLabel}
                dotClass={col.dotClass}
                leads={leadsByColumn[col.id] ?? []}
                onAddLead={onAddLead}
                onOpenLead={onOpenLead}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
