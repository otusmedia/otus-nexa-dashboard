"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { clientCrmResumesEnabledForSlug } from "@/lib/client-crm-features";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { dispatchCrmAppointmentCompleted } from "@/lib/crm-appointment-events";
import {
  CRM_KANBAN_COLUMNS,
  CRM_RESUME_INITIAL_STATUS,
  CRM_RESUME_KANBAN_COLUMNS,
  completeCrmAppointment,
  crmAppointmentCompletionErrorMessage,
  crmMoneyInputValue,
  crmOfferingFieldsFromItems,
  formatAppointmentTime,
  formatCrmAppointmentCompletedAt,
  formatLeadCreatedAt,
  isCrmAppointmentDone,
  isResumeLead,
  isSalesLead,
  leadClosedValue,
  leadProposalValue,
  mapCrmAppointmentRow,
  mapCrmContactRow,
  mapCrmLeadRow,
  normalizeCrmServiceProductSelect,
  normalizeCrmSourceSelect,
  normalizeLeadStatus,
  normalizeResumeStatus,
  parseCrmMoney,
  parseCrmQuantity,
  type CrmAppointment,
  type CrmContact,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { uploadCrmLeadQuote } from "@/lib/crm-lead-quote";
import {
  isResumeFunnelSlug,
  isSalesFunnelSlug,
  normalizeFunnelStageStatus,
  SALES_FUNNEL_TRANSFER_STATUS,
  shouldTransferLeadToSalesFunnel,
  type CrmFunnelDef,
} from "@/lib/crm-funnels";
import { crmLeadStatusLabel, crmResumeStatusLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { findCrmOwnerUser, resolveCrmOwnerOptions } from "@/lib/crm-team-members";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CrmSourceField } from "@/modules/crm/crm-source-field";
import {
  isCrmOfferingItemsSchemaError,
  isCrmOfferingKindSchemaError,
  isCrmQuantitySchemaError,
  isCrmServiceProductSchemaError,
  type CrmOfferingKind,
} from "@/lib/crm-custom-service-products";
import { useCrmServiceProductOptions } from "@/modules/crm/use-crm-service-product-options";
import { useCrmSourceOptions } from "@/modules/crm/use-crm-source-options";
import {
  CRM_QUANTITY_UNITS,
  normalizeCrmQuantityUnitSelect,
  parseCrmServiceProductBlob,
  primaryParsedCrmProduct,
} from "@/lib/crm-service-product-parse";

type ProductLineDraft = {
  key: string;
  name: string;
  quantityStr: string;
  quantityUnit: string;
};

function newProductLine(partial?: Partial<Omit<ProductLineDraft, "key">>): ProductLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: partial?.name ?? "",
    quantityStr: partial?.quantityStr ?? "",
    quantityUnit: partial?.quantityUnit ?? "",
  };
}

function productLinesFromLead(lead: CrmLead): ProductLineDraft[] {
  let items = lead.offering_items;
  if (items.length <= 1 && lead.service_product) {
    const blob = parseCrmServiceProductBlob(lead.service_product);
    if (blob.length > 1) {
      items = blob.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        quantity_unit: line.unit,
      }));
    }
  }
  if (items.length === 0) return [newProductLine()];
  return items.map((item) =>
    newProductLine({
      name: normalizeCrmServiceProductSelect(item.name),
      quantityStr: item.quantity != null ? String(item.quantity) : "",
      quantityUnit: normalizeCrmQuantityUnitSelect(item.quantity_unit) || "",
    }),
  );
}

function calendarTimesFromAppointment(dateStr: string | null, timeStr: string | null): { start_at: string; end_at: string } {
  const d = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  let h = 9;
  let mi = 0;
  if (timeStr?.trim()) {
    const p = timeStr.trim().slice(0, 8).split(":");
    h = Number(p[0]) || 0;
    mi = Number(p[1]) || 0;
  }
  const start = new Date(`${d}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function normalizeYmd(dateStr: string | null): string {
  const raw = (dateStr ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function toPgTime(htmlTime: string): string | null {
  const t = htmlTime?.trim();
  if (!t) return null;
  if (t.length === 5 && t.includes(":")) return `${t}:00`;
  return t.length >= 8 ? t.slice(0, 8) : t;
}

function stageLabel(funnel: CrmFunnelDef, stageName: string, language: AppLanguage): string {
  if (isResumeFunnelSlug(funnel.slug)) return crmResumeStatusLabel(stageName, language);
  if (isSalesFunnelSlug(funnel.slug)) return crmLeadStatusLabel(stageName, language);
  return stageName;
}

type CrmLeadFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  funnel: CrmFunnelDef;
  lead?: CrmLead | null;
  initialStage?: string;
  onClose: () => void;
  onSaved: (lead: CrmLead, meta?: { transferredToSales?: boolean }) => void;
  onDeleted?: (leadId: string) => void;
  onLeadMovedToResume?: (leadId: string) => void;
  resumesEnabled?: boolean;
};

export function CrmLeadFormModal({
  open,
  mode,
  funnel,
  lead,
  initialStage,
  onClose,
  onSaved,
  onDeleted,
  onLeadMovedToResume,
  resumesEnabled,
}: CrmLeadFormModalProps) {
  const { dataClientSlug, users, currentUser, clients, pushNotification } = useAppContext();
  const { language, t: lt } = useLanguage();
  const leadClientSlug = dataClientSlug ?? "rocketride";
  const crmClientSlug = (lead?.client_slug ?? dataClientSlug) ?? null;
  const { sourceOptions, rememberSource } = useCrmSourceOptions(crmClientSlug);
  const [offeringKind, setOfferingKind] = useState<CrmOfferingKind | "">("");
  const { serviceProductOptions, rememberServiceProduct, removeServiceProduct } =
    useCrmServiceProductOptions(crmClientSlug, offeringKind || null);
  const defaultSource = sourceOptions[0] ?? "WhatsApp";
  const ownerOptions = useMemo(
    () => resolveCrmOwnerOptions(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );
  const resumesFeatureEnabled =
    resumesEnabled ?? clientCrmResumesEnabledForSlug(clients, crmClientSlug);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [source, setSource] = useState<string>(defaultSource);
  const [serviceProduct, setServiceProduct] = useState("");
  const [productLines, setProductLines] = useState<ProductLineDraft[]>(() => [newProductLine()]);
  const [proposalValueStr, setProposalValueStr] = useState("0,00");
  const [closedValueStr, setClosedValueStr] = useState("0,00");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(initialStage ?? funnel.stages[0]?.name ?? "New Lead");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [contactSuggestions, setContactSuggestions] = useState<CrmContact[]>([]);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [quoteUrl, setQuoteUrl] = useState<string | null>(null);
  const [quoteName, setQuoteName] = useState<string | null>(null);
  const [quoteUploading, setQuoteUploading] = useState(false);
  const quoteInputRef = useRef<HTMLInputElement>(null);
  const contactSearchSeq = useRef(0);
  /** Only close when pointer down + click both start on the backdrop (not text-drag out of the form). */
  const backdropDismissRef = useRef(false);
  const [appointments, setAppointments] = useState<CrmAppointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptDraft, setApptDraft] = useState({
    title: "",
    date: "",
    time: "",
    owner: "",
    description: "",
  });
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);
  const [completingApptId, setCompletingApptId] = useState<string | null>(null);
  const [deleteLeadModalOpen, setDeleteLeadModalOpen] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState("");
  const [deletingLead, setDeletingLead] = useState(false);
  const [markResumeModalOpen, setMarkResumeModalOpen] = useState(false);
  const [markingResume, setMarkingResume] = useState(false);
  const [moveBackToSalesModalOpen, setMoveBackToSalesModalOpen] = useState(false);
  const [movingBackToSales, setMovingBackToSales] = useState(false);

  const isResume = funnel ? isResumeFunnelSlug(funnel.slug) : lead ? isResumeLead(lead) : false;
  const isSales = funnel ? isSalesFunnelSlug(funnel.slug) : lead ? isSalesLead(lead) : false;
  const eventClientSlug = (lead?.client_slug ?? dataClientSlug ?? "").trim() || null;

  const statusColumns = useMemo(() => {
    if (funnel) {
      return funnel.stages.map((stage) => ({
        id: stage.name,
        label: stageLabel(funnel, stage.name, language),
      }));
    }
    if (lead && isResumeLead(lead)) {
      return CRM_RESUME_KANBAN_COLUMNS.map((c) => ({
        id: c.id,
        label: crmResumeStatusLabel(c.id, language),
      }));
    }
    return CRM_KANBAN_COLUMNS.map((c) => ({
      id: c.id,
      label: crmLeadStatusLabel(c.id, language),
    }));
  }, [funnel, lead, language]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setSource(defaultSource);
      setServiceProduct("");
      setOfferingKind("");
      setProductLines([newProductLine()]);
      setProposalValueStr(crmMoneyInputValue(0));
      setClosedValueStr(crmMoneyInputValue(0));
      setOwner(
        ownerOptions.some((m) => m.name === currentUser.name.trim())
          ? currentUser.name.trim()
          : "",
      );
      setDescription("");
      setNotes("");
      setCnpj("");
      setQuoteUrl(null);
      setQuoteName(null);
      setStatus(initialStage ?? funnel.stages[0]?.name ?? "New Lead");
      setNameError("");
      setContactSuggestions([]);
      setContactSearchOpen(false);
      return;
    }
    if (!lead) return;
    setName(lead.name);
    setCompany(lead.company ?? "");
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setCnpj(lead.cnpj ?? "");
    setSource(normalizeCrmSourceSelect(lead.source, crmClientSlug));
    const kindFromLead = lead.offering_kind;
    const inferredKind: CrmOfferingKind | "" =
      kindFromLead ??
      (lead.quantity != null || lead.quantity_unit
        ? "product"
        : lead.service_product
          ? "product"
          : "");
    setOfferingKind(inferredKind);
    if (inferredKind === "service") {
      const parsed = primaryParsedCrmProduct(lead.service_product);
      setServiceProduct(
        normalizeCrmServiceProductSelect(parsed.name || lead.service_product),
      );
      setProductLines([newProductLine()]);
    } else if (inferredKind === "product") {
      setServiceProduct("");
      setProductLines(productLinesFromLead(lead));
    } else {
      setServiceProduct("");
      setProductLines([newProductLine()]);
    }
    setProposalValueStr(crmMoneyInputValue(leadProposalValue(lead)));
    setClosedValueStr(crmMoneyInputValue(leadClosedValue(lead)));
    setOwner(lead.owner ?? "");
    setDescription(lead.description ?? "");
    setNotes(lead.notes ?? "");
    setQuoteUrl(lead.quote_url ?? null);
    setQuoteName(lead.quote_name ?? null);
    setStatus(
      funnel
        ? normalizeFunnelStageStatus(lead.status, funnel.stages)
        : isResumeLead(lead)
          ? normalizeResumeStatus(lead.status)
          : normalizeLeadStatus(lead.status),
    );
    setNameError("");
    setContactSuggestions([]);
    setContactSearchOpen(false);
  }, [open, mode, lead, initialStage, funnel, defaultSource, crmClientSlug, ownerOptions, currentUser.name]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleteLeadModalOpen || markResumeModalOpen || moveBackToSalesModalOpen || deleteApptId) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    open,
    onClose,
    deleteLeadModalOpen,
    markResumeModalOpen,
    moveBackToSalesModalOpen,
    deleteApptId,
  ]);

  useEffect(() => {
    if (!open || mode !== "create") return;
    const q = name.trim().replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
    if (q.length < 2) {
      setContactSuggestions([]);
      return;
    }
    const seq = ++contactSearchSeq.current;
    const timer = window.setTimeout(async () => {
      let query = supabase
        .from("crm_contacts")
        .select("*")
        .or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(8);
      if (leadClientSlug) query = query.eq("client_slug", leadClientSlug);
      const { data, error } = await query;
      if (seq !== contactSearchSeq.current) return;
      if (error) {
        console.error("[crm] contact search", error.message);
        setContactSuggestions([]);
        return;
      }
      setContactSuggestions((data ?? []).map((row) => mapCrmContactRow(row as Record<string, unknown>)));
      setContactSearchOpen(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, mode, name, leadClientSlug]);

  const applyContactSuggestion = (contact: CrmContact) => {
    setName(contact.name || name);
    setCompany(contact.company ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    if (contact.source) setSource(normalizeCrmSourceSelect(contact.source, crmClientSlug));
    setContactSuggestions([]);
    setContactSearchOpen(false);
    setNameError("");
  };

  const handleQuoteSelected = async (file: File | null) => {
    if (!file) return;
    setQuoteUploading(true);
    const leadKey = lead?.id ?? `draft-${Date.now()}`;
    const result = await uploadCrmLeadQuote(leadClientSlug, leadKey, file);
    setQuoteUploading(false);
    if (!result.ok) {
      console.error("[crm] quote upload", result.error);
      pushNotification(lt("Could not upload quote."), "task");
      return;
    }
    setQuoteUrl(result.url);
    setQuoteName(result.name);
    pushNotification(lt("Quote uploaded."), "task");
  };

  const loadAppointments = useCallback(async () => {
    if (!lead?.id) {
      setAppointments([]);
      setApptsLoading(false);
      return;
    }
    setApptsLoading(true);
    const { data, error } = await supabase
      .from("crm_appointments")
      .select("*")
      .eq("lead_id", lead.id)
      .order("date", { ascending: true });
    if (error) {
      console.error("[crm appointments]", error.message);
      setAppointments([]);
    } else {
      setAppointments((data ?? []).map((row) => mapCrmAppointmentRow(row as Record<string, unknown>)));
    }
    setApptsLoading(false);
  }, [lead?.id]);

  useEffect(() => {
    if (!open || mode !== "edit" || !lead?.id) {
      setAppointments([]);
      setShowApptForm(false);
      setApptDraft({ title: "", date: "", time: "", owner: "", description: "" });
      return;
    }
    void loadAppointments();
    const channel = supabase
      .channel(`crm-appointments-${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_appointments", filter: `lead_id=eq.${lead.id}` },
        () => {
          void loadAppointments();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, mode, lead?.id, loadAppointments]);

  const ownerTransferPending = useMemo(() => {
    if (!funnel || funnel.isBuiltin) return false;
    const ownerName = owner.trim();
    if (!ownerName) return false;
    const ownerUser = findCrmOwnerUser(users, ownerName);
    return shouldTransferLeadToSalesFunnel(funnel, ownerUser);
  }, [funnel, owner, users]);

  const syncContactFromLead = async (createdLead: CrmLead) => {
    const leadEmail = (createdLead.email ?? "").trim();
    if (leadEmail) {
      const { data: existing, error: existingErr } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("email", leadEmail)
        .maybeSingle();
      if (existingErr) console.error("[crm] check existing contact", existingErr.message);
      if (!existing?.id) {
        const { error: contactErr } = await supabase.from("crm_contacts").insert([
          {
            name: createdLead.name,
            company: createdLead.company ?? "",
            email: createdLead.email ?? "",
            phone: createdLead.phone ?? "",
            role: "",
            source: createdLead.source ?? "",
            notes: `Auto-created from lead: ${createdLead.name}`,
            client_slug: leadClientSlug,
          },
        ]);
        if (contactErr) console.error("[crm] auto-create contact", contactErr.message);
      }
      return;
    }
    const { error: contactErr } = await supabase.from("crm_contacts").insert([
      {
        name: createdLead.name,
        company: createdLead.company ?? "",
        email: "",
        phone: createdLead.phone ?? "",
        role: "",
        source: createdLead.source ?? "",
        notes: `Auto-created from lead: ${createdLead.name}`,
        client_slug: leadClientSlug,
      },
    ]);
    if (contactErr) console.error("[crm] auto-create contact", contactErr.message);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(lt("Name is required."));
      return;
    }
    const proposalNum = parseCrmMoney(proposalValueStr);
    const closedNum = parseCrmMoney(closedValueStr);
    const sourceTrimmed = source.trim();
    const offeringKindValue = offeringKind || null;
    const offeringFields =
      offeringKind === "service"
        ? crmOfferingFieldsFromItems([
            {
              name: normalizeCrmServiceProductSelect(serviceProduct),
              quantity: null,
              quantity_unit: null,
            },
          ])
        : offeringKind === "product"
          ? crmOfferingFieldsFromItems(
              productLines.map((line) => {
                const parsed = primaryParsedCrmProduct(line.name);
                return {
                  name: normalizeCrmServiceProductSelect(parsed.name || line.name),
                  quantity: parseCrmQuantity(line.quantityStr),
                  quantity_unit: normalizeCrmQuantityUnitSelect(line.quantityUnit) || null,
                };
              }),
            )
          : crmOfferingFieldsFromItems([]);
    const serviceProductTrimmed = offeringFields.service_product;
    const quantityNum = offeringKind === "product" ? offeringFields.quantity : null;
    const quantityUnitTrimmed = offeringKind === "product" ? offeringFields.quantity_unit : null;
    const offeringItemsPayload =
      offeringKind === "product"
        ? offeringFields.offering_items
        : offeringKind === "service" && serviceProductTrimmed
          ? offeringFields.offering_items
          : [];
    const ownerName = owner.trim();
    const ownerUser = findCrmOwnerUser(users, ownerName);
    const transferToSales = shouldTransferLeadToSalesFunnel(funnel, ownerUser);
    const cnpjTrimmed = cnpj.trim() || null;
    setSaving(true);

    if (mode === "create") {
      const leadFunnel = transferToSales ? "sales" : funnel.slug;
      const leadStatus = transferToSales ? SALES_FUNNEL_TRANSFER_STATUS : status;
      const insertPayload: Record<string, unknown> = {
        name: trimmed,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        cnpj: cnpjTrimmed,
        source: sourceTrimmed || null,
        offering_kind: offeringKindValue,
        offering_items: offeringItemsPayload,
        service_product: serviceProductTrimmed || null,
        quantity: quantityNum,
        quantity_unit: quantityUnitTrimmed,
        value: proposalNum,
        proposal_value: proposalNum,
        closed_value: closedNum,
        owner: ownerName || null,
        description: description.trim() || null,
        quote_url: quoteUrl,
        quote_name: quoteName,
        status: leadStatus,
        funnel: leadFunnel,
        client_slug: leadClientSlug,
      };
      let { data, error } = await supabase.from("crm_leads").insert(insertPayload).select("*").maybeSingle();
      if (error && isCrmOfferingItemsSchemaError(error.message)) {
        pushNotification(
          lt("CRM offering items migration required. Run supabase/crm-lead-offering-items.sql in Supabase."),
          "task",
        );
        const { offering_items: _items, ...withoutItems } = insertPayload;
        ({ data, error } = await supabase.from("crm_leads").insert(withoutItems).select("*").maybeSingle());
      }
      if (error && isCrmOfferingKindSchemaError(error.message)) {
        pushNotification(
          lt("CRM offering kind migration required. Run supabase/crm-lead-offering-kind.sql in Supabase."),
          "task",
        );
        const { offering_kind: _ok, ...withoutKind } = insertPayload;
        ({ data, error } = await supabase.from("crm_leads").insert(withoutKind).select("*").maybeSingle());
      }
      if (error && isCrmQuantitySchemaError(error.message)) {
        pushNotification(
          lt("CRM quantity migration required. Run supabase/crm-lead-quantity.sql in Supabase."),
          "task",
        );
        const { quantity: _q, quantity_unit: _u, ...withoutQty } = insertPayload;
        ({ data, error } = await supabase.from("crm_leads").insert(withoutQty).select("*").maybeSingle());
      }
      if (error && /cnpj|quote_url|quote_name/i.test(error.message)) {
        pushNotification(
          lt("CRM CNPJ/quote migration required. Run supabase/crm-lead-cnpj-quote.sql in Supabase."),
          "task",
        );
        const { cnpj: _c, quote_url: _u, quote_name: _n, ...fallback } = insertPayload;
        ({ data, error } = await supabase.from("crm_leads").insert(fallback).select("*").maybeSingle());
      }
      setSaving(false);
      if (error) {
        console.error("[crm] add lead", error.message);
        if (isCrmServiceProductSchemaError(error.message)) {
          pushNotification(lt("CRM service/product migration required. Run supabase/crm-lead-service-product.sql in Supabase."), "task");
        }
        return;
      }
      if (sourceTrimmed) await rememberSource(sourceTrimmed);
      for (const item of offeringItemsPayload) {
        if (item.name) await rememberServiceProduct(item.name);
      }
      if (data) {
        const createdLead = mapCrmLeadRow(data as Record<string, unknown>);
        await syncContactFromLead(createdLead);
        onSaved(createdLead, { transferredToSales: transferToSales });
        onClose();
      }
      return;
    }

    if (!lead) {
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
    const normalizedStatus = funnel
      ? normalizeFunnelStageStatus(status, funnel.stages)
      : isResumeLead(lead)
        ? normalizeResumeStatus(status)
        : normalizeLeadStatus(status);

    const updatePayload: Record<string, unknown> = {
      name: trimmed,
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      cnpj: cnpjTrimmed,
      source: sourceTrimmed || null,
      offering_kind: offeringKindValue,
      offering_items: offeringItemsPayload,
      service_product: serviceProductTrimmed || null,
      quantity: quantityNum,
      quantity_unit: quantityUnitTrimmed,
      value: proposalNum,
      proposal_value: proposalNum,
      closed_value: closedNum,
      owner: ownerName || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      quote_url: quoteUrl,
      quote_name: quoteName,
      status: normalizedStatus,
      updated_at: now,
    };
    if (transferToSales) {
      updatePayload.funnel = "sales";
      updatePayload.status = SALES_FUNNEL_TRANSFER_STATUS;
    }

    let { data, error } = await supabase
      .from("crm_leads")
      .update(updatePayload)
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    if (error && isCrmOfferingItemsSchemaError(error.message)) {
      pushNotification(
        lt("CRM offering items migration required. Run supabase/crm-lead-offering-items.sql in Supabase."),
        "task",
      );
      const { offering_items: _items, ...withoutItems } = updatePayload;
      ({ data, error } = await supabase
        .from("crm_leads")
        .update(withoutItems)
        .eq("id", lead.id)
        .select("*")
        .maybeSingle());
    }
    if (error && isCrmOfferingKindSchemaError(error.message)) {
      pushNotification(
        lt("CRM offering kind migration required. Run supabase/crm-lead-offering-kind.sql in Supabase."),
        "task",
      );
      const { offering_kind: _ok, ...withoutKind } = updatePayload;
      ({ data, error } = await supabase
        .from("crm_leads")
        .update(withoutKind)
        .eq("id", lead.id)
        .select("*")
        .maybeSingle());
    }
    if (error && isCrmQuantitySchemaError(error.message)) {
      pushNotification(
        lt("CRM quantity migration required. Run supabase/crm-lead-quantity.sql in Supabase."),
        "task",
      );
      const { quantity: _q, quantity_unit: _u, ...withoutQty } = updatePayload;
      ({ data, error } = await supabase
        .from("crm_leads")
        .update(withoutQty)
        .eq("id", lead.id)
        .select("*")
        .maybeSingle());
    }
    if (error && /cnpj|quote_url|quote_name/i.test(error.message)) {
      pushNotification(
        lt("CRM CNPJ/quote migration required. Run supabase/crm-lead-cnpj-quote.sql in Supabase."),
        "task",
      );
      const { cnpj: _c, quote_url: _u, quote_name: _n, ...fallback } = updatePayload;
      ({ data, error } = await supabase
        .from("crm_leads")
        .update(fallback)
        .eq("id", lead.id)
        .select("*")
        .maybeSingle());
    }
    setSaving(false);
    if (error) {
      console.error("[crm] save lead", error.message);
      if (isCrmServiceProductSchemaError(error.message)) {
        pushNotification(lt("CRM service/product migration required. Run supabase/crm-lead-service-product.sql in Supabase."), "task");
      }
      return;
    }
    if (sourceTrimmed) await rememberSource(sourceTrimmed);
    for (const item of offeringItemsPayload) {
      if (item.name) await rememberServiceProduct(item.name);
    }
    if (transferToSales && funnel) {
      const { error: logErr } = await supabase.from("crm_activity_log").insert({
        lead_id: lead.id,
        client_slug: clientSlug,
        actor_name: actor,
        event_type: "lead_transferred_to_sales",
        payload: {
          from_funnel: funnel.slug,
          to_funnel: "sales",
          owner: ownerName,
        },
      });
      if (logErr) console.error("[crm] activity log", logErr.message);
      pushNotification(lt("Lead transferred to Sales pipeline"), "task");
    }
    if (data) {
      onSaved(mapCrmLeadRow(data as Record<string, unknown>), { transferredToSales: transferToSales });
      onClose();
    }
  };

  const saveAppointment = async () => {
    if (!lead) return;
    const title = apptDraft.title.trim();
    if (!title) return;
    const timeVal = toPgTime(apptDraft.time);
    const { data, error } = await supabase
      .from("crm_appointments")
      .insert({
        lead_id: lead.id,
        title,
        date: apptDraft.date || null,
        time: timeVal,
        owner: apptDraft.owner.trim() ? apptDraft.owner.trim() : null,
        description: apptDraft.description.trim() || null,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] add appointment", error.message);
      return;
    }
    if (data) {
      const created = mapCrmAppointmentRow(data as Record<string, unknown>);
      setAppointments((prev) => [...prev, created]);
      const leadName = lead.name;
      const normalizedDate = normalizeYmd(created.date);
      const { start_at, end_at } = calendarTimesFromAppointment(normalizedDate, created.time);
      const descParts = [
        `CRM Lead: ${leadName}`,
        created.description ?? "",
        created.owner ? `Owner: ${created.owner}` : "",
        currentUser.name ? `— ${currentUser.name}` : "",
      ].filter(Boolean);
      const calendarPayload = {
        title: created.title,
        type: "meeting",
        description: descParts.join("\n"),
        start_at,
        end_at,
        all_day: false,
        meet_link: null,
        location: null,
        color: "#10b981",
        created_by: null,
        client_slug: eventClientSlug,
        source: "crm",
        source_id: created.id,
        lead_id: lead.id,
        lead_name: leadName,
      };
      const calIns = await supabase.from("calendar_events").insert(calendarPayload).select("id").maybeSingle();
      if (calIns.error) {
        console.error("[crm] calendar sync insert", calIns.error.message);
      } else if (calIns.data?.id) {
        const ownerName = created.owner?.trim() ?? "";
        const inv = ownerName ? ownerOptions.find((u) => u.name === ownerName) : undefined;
        if (inv?.email) {
          const { error: invErr } = await supabase.from("calendar_event_invitees").insert({
            event_id: String(calIns.data.id),
            email: inv.email,
            user_id: null,
            status: "pending",
          });
          if (invErr) console.error("[crm] calendar invitee", invErr.message);
        }
      }
    }
    setApptDraft({ title: "", date: "", time: "", owner: "", description: "" });
    setShowApptForm(false);
  };

  const confirmDeleteAppointment = async () => {
    if (!deleteApptId) return;
    const apptId = deleteApptId;
    const { error } = await supabase.from("crm_appointments").delete().eq("id", apptId);
    if (error) {
      console.error("[crm] delete appt", error.message);
      setDeleteApptId(null);
      return;
    }
    const { error: calDelErr } = await supabase.from("calendar_events").delete().eq("source", "crm").eq("source_id", apptId);
    if (calDelErr) console.error("[crm] calendar delete", calDelErr.message);
    setAppointments((prev) => prev.filter((a) => a.id !== apptId));
    setDeleteApptId(null);
  };

  const markAppointmentDone = async (apptId: string) => {
    if (!lead) return;
    const actor = currentUser.name?.trim() || currentUser.email?.trim() || "";
    if (!actor) {
      pushNotification(crmAppointmentCompletionErrorMessage("MISSING_ACTOR", language), "task");
      return;
    }
    setCompletingApptId(apptId);
    const result = await completeCrmAppointment(apptId, actor, language);
    setCompletingApptId(null);
    if (!result.ok) {
      const msg = crmAppointmentCompletionErrorMessage(result.error, language);
      pushNotification(`${lt("Could not complete appointment")}: ${msg}`, "task");
      console.error("[crm] complete appointment", result.error);
      return;
    }
    const completedAt = new Date().toISOString();
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? { ...a, status: "done", completed_at: completedAt, completed_by: actor }
          : a,
      ),
    );
    pushNotification(lt("Appointment marked as done"), "task");
    dispatchCrmAppointmentCompleted(apptId, result.leadId ?? lead.id);
  };

  const confirmDeleteLead = async () => {
    if (deletePasskey !== "DELETE" || deletingLead || !lead) return;
    setDeletingLead(true);
    const leadId = lead.id;
    const { error: calErr } = await supabase.from("calendar_events").delete().eq("lead_id", leadId);
    if (calErr) console.error("[crm] delete lead calendar events", calErr.message);
    const { error: apptErr } = await supabase.from("crm_appointments").delete().eq("lead_id", leadId);
    if (apptErr) console.error("[crm] delete lead appointments", apptErr.message);
    const { error: leadErr } = await supabase.from("crm_leads").delete().eq("id", leadId);
    setDeletingLead(false);
    if (leadErr) {
      console.error("[crm] delete lead", leadErr.message);
      return;
    }
    setDeleteLeadModalOpen(false);
    setDeletePasskey("");
    onDeleted?.(leadId);
    onClose();
  };

  const confirmMarkAsResume = async () => {
    if (!lead || !isSalesLead(lead)) return;
    setMarkingResume(true);
    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const noteLine = lt("Moved to resume funnel by {name} on {date}")
      .replace("{name}", actor)
      .replace("{date}", new Date().toLocaleString(language === "pt-BR" ? "pt-BR" : "en-US"));
    const existingNotes = (lead.notes ?? "").trim();
    const notes = existingNotes ? `${existingNotes}\n\n${noteLine}` : noteLine;
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
    const { data, error } = await supabase
      .from("crm_leads")
      .update({
        funnel: "resume",
        status: CRM_RESUME_INITIAL_STATUS,
        notes,
        updated_at: now,
      })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] mark as resume", error.message);
      setMarkingResume(false);
      return;
    }
    await supabase.from("crm_activity_log").insert({
      lead_id: lead.id,
      client_slug: clientSlug,
      actor_name: actor,
      event_type: "lead_moved_to_resume",
      payload: { from_funnel: "sales", to_funnel: "resume" },
    });
    setMarkingResume(false);
    setMarkResumeModalOpen(false);
    if (data) {
      if (onLeadMovedToResume) onLeadMovedToResume(lead.id);
      else onSaved(mapCrmLeadRow(data as Record<string, unknown>));
      onClose();
    }
  };

  const confirmMoveBackToSales = async () => {
    if (!lead || !isResumeLead(lead)) return;
    setMovingBackToSales(true);
    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const noteLine = lt("Moved back to sales funnel as Disqualified by {name} on {date}")
      .replace("{name}", actor)
      .replace("{date}", new Date().toLocaleString(language === "pt-BR" ? "pt-BR" : "en-US"));
    const existingNotes = (lead.notes ?? "").trim();
    const notes = existingNotes ? `${existingNotes}\n\n${noteLine}` : noteLine;
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
    const salesStatus: CrmLeadStatus = "Disqualified";
    const { data, error } = await supabase
      .from("crm_leads")
      .update({
        funnel: "sales",
        status: salesStatus,
        notes,
        updated_at: now,
      })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] move back to sales", error.message);
      setMovingBackToSales(false);
      return;
    }
    await supabase.from("crm_activity_log").insert({
      lead_id: lead.id,
      client_slug: clientSlug,
      actor_name: actor,
      event_type: "lead_moved_to_sales",
      payload: { from_funnel: "resume", to_funnel: "sales", status: salesStatus },
    });
    setMovingBackToSales(false);
    setMoveBackToSalesModalOpen(false);
    if (data) {
      onSaved(mapCrmLeadRow(data as Record<string, unknown>));
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[125] overflow-y-auto overscroll-contain bg-black/70 p-4"
        role="presentation"
      >
        <div
          className="flex min-h-full items-center justify-center"
          onPointerDown={(e) => {
            backdropDismissRef.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (backdropDismissRef.current && e.target === e.currentTarget) {
              onClose();
            }
            backdropDismissRef.current = false;
          }}
        >
        <form
          onSubmit={handleSubmit}
          onPointerDown={() => {
            backdropDismissRef.current = false;
          }}
          onClick={(e) => e.stopPropagation()}
          className="my-4 flex max-h-[min(92vh,900px)] w-full max-w-xl flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="shrink-0 border-b border-[var(--border)] p-4 pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">
                {mode === "create" ? lt("Add New Lead") : lt("Edit Lead")}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
              >
                {lt("Close")}
              </button>
            </div>
            {mode === "edit" && lead ? (
              <p className="mt-2 text-xs text-[rgba(255,255,255,0.45)]">
                {lt("Created")} {formatLeadCreatedAt(lead.created_at)}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <label className="block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Description")}</span>
              <AutoResizeTextarea
                key={mode === "edit" ? lead?.id : "create"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minRows={3}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="mt-4">
              {mode === "create" ? (
                <p className="text-xs text-[rgba(255,255,255,0.45)]">
                  {lt("Status")}: {stageLabel(funnel, status, language)}
                </p>
              ) : (
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    {lt("Status")}
                  </span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {statusColumns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="relative block space-y-1 md:col-span-2">
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Name *")}</span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    onFocus={() => {
                      if (mode === "create" && contactSuggestions.length > 0) setContactSearchOpen(true);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setContactSearchOpen(false), 150);
                    }}
                    autoComplete="off"
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                    required
                  />
                </label>
                {nameError ? <p className="text-xs text-[#f87171]">{nameError}</p> : null}
                {mode === "create" && contactSearchOpen && contactSuggestions.length > 0 ? (
                  <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-48 overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                    <li className="px-3 py-1 text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                      {lt("Matching contacts")}
                    </li>
                    {contactSuggestions.map((contact) => (
                      <li key={contact.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyContactSuggestion(contact)}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-white hover:bg-[rgba(255,255,255,0.06)]"
                        >
                          <span>{contact.name}</span>
                          <span className="text-xs text-[rgba(255,255,255,0.45)]">
                            {[contact.company, contact.email].filter(Boolean).join(" · ") || contact.phone || "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Company")}</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("CNPJ")}</span>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Email")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Phone")}</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Source")}</span>
                <CrmSourceField
                  value={source}
                  onChange={setSource}
                  sourceOptions={sourceOptions}
                  language={language}
                  hint={lt("Select or type a new source")}
                  onCreateOption={rememberSource}
                />
              </div>
              <div className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  {lt("Offering type")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "service" as const, label: lt("Service") },
                      { id: "product" as const, label: lt("Product") },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setOfferingKind(opt.id);
                        if (opt.id === "service") {
                          setProductLines([newProductLine()]);
                        } else if (productLines.length === 0) {
                          setProductLines([newProductLine()]);
                        }
                      }}
                      className={cn(
                        "rounded-[8px] border px-3 py-2 text-sm transition",
                        offeringKind === opt.id
                          ? "border-[var(--primary)] bg-[rgba(255,69,0,0.15)] text-white"
                          : "border-[var(--border)] bg-[var(--surface-elevated)] text-white/60 hover:text-white",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {offeringKind === "service" ? (
                <div className="block space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    {lt("Service")}
                  </span>
                  <CrmSourceField
                    value={serviceProduct}
                    onChange={setServiceProduct}
                    sourceOptions={serviceProductOptions}
                    language={language}
                    hint={lt("Select or type a new service")}
                    onCreateOption={async (name) => {
                      const formatted = normalizeCrmServiceProductSelect(name);
                      setServiceProduct(formatted);
                      await rememberServiceProduct(formatted);
                    }}
                    formatOptionLabel={(value) => normalizeCrmServiceProductSelect(value) || value}
                    createOptionLabel={(name) =>
                      lt('Add service "{name}"').replace(
                        "{name}",
                        normalizeCrmServiceProductSelect(name) || name,
                      )
                    }
                    onDeleteOption={async (name) => {
                      await removeServiceProduct(name);
                    }}
                    deleteConfirmMessage={(name) =>
                      lt('Remove service "{name}" from the list?').replace("{name}", name)
                    }
                  />
                </div>
              ) : null}
              {offeringKind === "product" ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                      {lt("Product")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setProductLines((prev) => [...prev, newProductLine()])}
                      className="inline-flex items-center gap-1 text-xs text-[rgba(255,255,255,0.55)] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {lt("Add product line")}
                    </button>
                  </div>
                  {productLines.map((line, index) => (
                    <div
                      key={line.key}
                      className="space-y-2 rounded-[8px] border border-[var(--border)] p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                            {lt("Product")}
                            {productLines.length > 1 ? ` ${index + 1}` : ""}
                          </span>
                          <CrmSourceField
                            value={line.name}
                            onChange={(value) => {
                              const lines = parseCrmServiceProductBlob(value);
                              if (
                                lines.length > 1 ||
                                (lines[0] && (lines[0].quantity != null || lines[0].unit))
                              ) {
                                const primary = lines[0]!;
                                setProductLines((prev) =>
                                  prev.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          name: primary.name,
                                          quantityStr:
                                            primary.quantity != null
                                              ? String(Math.trunc(primary.quantity))
                                              : row.quantityStr,
                                          quantityUnit: primary.unit || row.quantityUnit,
                                        }
                                      : row,
                                  ),
                                );
                                for (const parsed of lines) {
                                  if (parsed.name) void rememberServiceProduct(parsed.name);
                                }
                                return;
                              }
                              setProductLines((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, name: value } : row)),
                              );
                            }}
                            sourceOptions={serviceProductOptions}
                            language={language}
                            hint={lt("Select or type a new product")}
                            onCreateOption={async (name) => {
                              const lines = parseCrmServiceProductBlob(name);
                              const primary = lines[0] ?? primaryParsedCrmProduct(name);
                              const formatted = normalizeCrmServiceProductSelect(
                                primary.name || name,
                              );
                              setProductLines((prev) =>
                                prev.map((row, i) =>
                                  i === index
                                    ? {
                                        ...row,
                                        name: formatted,
                                        quantityStr:
                                          primary.quantity != null
                                            ? String(Math.trunc(primary.quantity))
                                            : row.quantityStr,
                                        quantityUnit: primary.unit || row.quantityUnit,
                                      }
                                    : row,
                                ),
                              );
                              for (const parsed of lines.length ? lines : [primary]) {
                                if (parsed.name) await rememberServiceProduct(parsed.name);
                              }
                            }}
                            formatOptionLabel={(value) =>
                              normalizeCrmServiceProductSelect(value) || value
                            }
                            createOptionLabel={(name) =>
                              lt('Add product "{name}"').replace(
                                "{name}",
                                normalizeCrmServiceProductSelect(
                                  primaryParsedCrmProduct(name).name || name,
                                ) || name,
                              )
                            }
                            onDeleteOption={async (name) => {
                              await removeServiceProduct(name);
                            }}
                            deleteConfirmMessage={(name) =>
                              lt('Remove product "{name}" from the list?').replace("{name}", name)
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setProductLines((prev) =>
                              prev.length <= 1
                                ? [newProductLine()]
                                : prev.filter((_, i) => i !== index),
                            )
                          }
                          disabled={productLines.length <= 1 && !line.name}
                          className="mt-6 rounded-md p-1.5 text-[rgba(255,255,255,0.4)] hover:text-[#f87171] disabled:opacity-30"
                          aria-label={lt("Remove product line")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                            {lt("Quantity")}
                          </span>
                          <input
                            value={line.quantityStr}
                            onChange={(e) => {
                              const quantityStr = e.target.value.replace(/[^\d]/g, "");
                              setProductLines((prev) =>
                                prev.map((row, i) =>
                                  i === index ? { ...row, quantityStr } : row,
                                ),
                              );
                            }}
                            inputMode="numeric"
                            placeholder="1"
                            className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                            {lt("Unit")}
                          </span>
                          <select
                            value={line.quantityUnit}
                            onChange={(e) => {
                              const quantityUnit = e.target.value;
                              setProductLines((prev) =>
                                prev.map((row, i) =>
                                  i === index ? { ...row, quantityUnit } : row,
                                ),
                              );
                            }}
                            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                          >
                            <option value="">{lt("Select unit")}</option>
                            {CRM_QUANTITY_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                            {line.quantityUnit &&
                            !CRM_QUANTITY_UNITS.includes(
                              line.quantityUnit as (typeof CRM_QUANTITY_UNITS)[number],
                            ) ? (
                              <option value={line.quantityUnit}>{line.quantityUnit}</option>
                            ) : null}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Proposal value")}</span>
                <input
                  value={proposalValueStr}
                  onChange={(e) => setProposalValueStr(e.target.value)}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Closed value")}</span>
                <input
                  value={closedValueStr}
                  onChange={(e) => setClosedValueStr(e.target.value)}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  <option value="">{lt("Unassigned")}</option>
                  {ownerOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {ownerTransferPending ? (
                  <p className="text-xs text-[rgba(255,255,255,0.45)]">{lt("Owner outside funnel transfer hint")}</p>
                ) : null}
              </label>
              <div className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  {lt("Quote / estimate")}
                </span>
                <input
                  ref={quoteInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handleQuoteSelected(file);
                  }}
                />
                {quoteUrl ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                    <a
                      href={quoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-white underline-offset-2 hover:underline"
                    >
                      {quoteName || lt("Quote / estimate")}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setQuoteUrl(null);
                        setQuoteName(null);
                      }}
                      className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
                    >
                      {lt("Remove quote")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={quoteUploading}
                    onClick={() => quoteInputRef.current?.click()}
                    className="w-full rounded-[8px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[rgba(255,255,255,0.65)] transition hover:text-white disabled:opacity-50"
                  >
                    {quoteUploading ? lt("Uploading quote…") : lt("Attach quote")}
                  </button>
                )}
              </div>
            </div>

            {mode === "edit" ? (
              <>
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <h4 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    {lt("Notes")}
                  </h4>
                  <AutoResizeTextarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    minRows={3}
                    className="mt-2 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                      {lt("APPOINTMENTS")}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowApptForm((v) => !v)}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-[0.65rem] text-white hover:bg-[var(--surface-elevated)]"
                    >
                      {showApptForm ? lt("Close") : lt("Add Appointment")}
                    </button>
                  </div>

                  {showApptForm ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[#161616] p-3">
                      <label className="block space-y-1">
                        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                          {lt("Title")} *
                        </span>
                        <input
                          value={apptDraft.title}
                          onChange={(e) => setApptDraft((p) => ({ ...p, title: e.target.value }))}
                          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Date")}</span>
                          <input
                            type="date"
                            value={apptDraft.date}
                            onChange={(e) => setApptDraft((p) => ({ ...p, date: e.target.value }))}
                            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Time")}</span>
                          <input
                            type="time"
                            value={apptDraft.time}
                            onChange={(e) => setApptDraft((p) => ({ ...p, time: e.target.value }))}
                            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                          />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                        <select
                          value={apptDraft.owner}
                          onChange={(e) => setApptDraft((p) => ({ ...p, owner: e.target.value }))}
                          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                        >
                          <option value="">{lt("Unassigned")}</option>
                          {ownerOptions.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                          {lt("Description")}
                        </span>
                        <textarea
                          value={apptDraft.description}
                          onChange={(e) => setApptDraft((p) => ({ ...p, description: e.target.value }))}
                          rows={2}
                          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowApptForm(false)}
                          className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                        >
                          {lt("Cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveAppointment()}
                          className="btn-primary rounded-[8px] px-3 py-1.5 text-xs"
                        >
                          {lt("Save")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {apptsLoading ? (
                    <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("Loading…")}</p>
                  ) : appointments.length === 0 ? (
                    <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("No appointments scheduled.")}</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {appointments.map((a) => {
                        const done = isCrmAppointmentDone(a);
                        return (
                          <li
                            key={a.id}
                            className={cn(
                              "rounded-lg border border-[var(--border)] bg-[#161616] p-3 text-sm text-white",
                              done && "opacity-80",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={cn("font-medium", done && "line-through text-[rgba(255,255,255,0.55)]")}>
                                    {a.title}
                                  </p>
                                  {done ? (
                                    <span className="rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-[0.65rem] font-medium text-[#86efac]">
                                      {lt("Done")}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                                  {a.date ?? "—"} · {formatAppointmentTime(a.time)}
                                  {a.owner ? ` · ${a.owner}` : ""}
                                </p>
                                {done && a.completed_by ? (
                                  <p className="mt-1 text-xs text-[#86efac]">
                                    {lt("Completed by")} {a.completed_by}
                                    {a.completed_at
                                      ? ` · ${formatCrmAppointmentCompletedAt(a.completed_at, language)}`
                                      : ""}
                                  </p>
                                ) : null}
                                {a.description?.trim() ? (
                                  <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.55)]">{a.description}</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {!done ? (
                                  <button
                                    type="button"
                                    disabled={completingApptId === a.id}
                                    onClick={() => void markAppointmentDone(a.id)}
                                    className="rounded-md border border-[rgba(34,197,94,0.35)] px-2 py-1 text-[0.65rem] font-medium text-[#86efac] transition hover:bg-[rgba(34,197,94,0.12)] disabled:opacity-50"
                                  >
                                    {completingApptId === a.id ? lt("Saving…") : lt("Mark as done")}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setDeleteApptId(a.id)}
                                  className="text-xs text-[#fca5a5] hover:underline"
                                >
                                  {lt("Delete")}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}

            {mode === "edit" ? (
              <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                {isSales && resumesFeatureEnabled ? (
                  <button
                    type="button"
                    onClick={() => setMarkResumeModalOpen(true)}
                    className="w-full rounded-[8px] border border-[var(--border-strong)] px-3 py-2 text-xs text-[rgba(255,255,255,0.75)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    {lt("Mark as resume")}
                  </button>
                ) : null}
                {isResume && resumesFeatureEnabled ? (
                  <button
                    type="button"
                    onClick={() => setMoveBackToSalesModalOpen(true)}
                    className="w-full rounded-[8px] border border-[var(--border-strong)] px-3 py-2 text-xs text-[rgba(255,255,255,0.75)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    {lt("Move back to sales (Disqualified)")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleteLeadModalOpen(true)}
                  className="w-full rounded-[8px] border px-3 py-2 text-xs text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
                  style={{ borderColor: "rgba(239,68,68,0.3)" }}
                >
                  {lt("Delete Lead")}
                </button>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] p-4 pt-3">
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Cancel")}
              </button>
              <button type="submit" disabled={saving} className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50">
                {saving ? lt("Saving…") : lt("Save")}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>

      {deleteLeadModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Delete Lead")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt(
                "This action is permanent and cannot be undone. All appointments linked to this lead will also be deleted.",
              )}
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Passkey")}</span>
              <input
                value={deletePasskey}
                onChange={(e) => setDeletePasskey(e.target.value)}
                placeholder={lt("Type DELETE to confirm")}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteLeadModalOpen(false);
                  setDeletePasskey("");
                }}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                disabled={deletingLead}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={deletePasskey !== "DELETE" || deletingLead}
                onClick={() => void confirmDeleteLead()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {deletingLead ? lt("Saving…") : lt("Delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {markResumeModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Mark as resume")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt("This lead will leave the sales pipeline and appear in the Resumes funnel as a new application.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMarkResumeModalOpen(false)}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                disabled={markingResume}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={markingResume}
                onClick={() => void confirmMarkAsResume()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {markingResume ? lt("Saving…") : lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveBackToSalesModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Move back to sales (Disqualified)")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt("This application will leave the Resumes funnel and return to the sales pipeline as Disqualified.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveBackToSalesModalOpen(false)}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                disabled={movingBackToSales}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={movingBackToSales}
                onClick={() => void confirmMoveBackToSales()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {movingBackToSales ? lt("Saving…") : lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteConfirmModal
        open={deleteApptId != null}
        title={lt("Delete appointment")}
        message={lt("Remove this appointment? This cannot be undone.")}
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setDeleteApptId(null)}
        onConfirm={() => void confirmDeleteAppointment()}
      />
    </>
  );
}
