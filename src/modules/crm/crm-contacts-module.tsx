"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { rowMatchesDataClient } from "@/lib/client-utils";
import { supabase } from "@/lib/supabase";
import { CRM_SOURCE_OPTIONS, mapCrmContactRow, type CrmContact } from "@/lib/crm-data";
import { crmSourceLabel } from "@/lib/crm-i18n";
import { formatDisplayDate } from "@/app/(platform)/projects/data";

function formatCreated(iso: string) {
  return formatDisplayDate(iso || null);
}

export function CrmContactsModule() {
  const { dataClientSlug } = useAppContext();
  const { language, t: lt } = useLanguage();
  const contactClientSlug = dataClientSlug ?? "rocketride";
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState<string>(CRM_SOURCE_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState("");

  const load = useCallback(async () => {
    const isInitialLoad = initialLoadRef.current;
    if (isInitialLoad) setLoading(true);
    const { data, error } = await supabase.from("crm_contacts").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("[crm contacts]", error.message);
      if (isInitialLoad) setContacts([]);
    } else {
      const mapped = ((data ?? []) as Record<string, unknown>[])
        .map((row) => mapCrmContactRow(row))
        .filter((c) => rowMatchesDataClient(c.client_slug, dataClientSlug));
      setContacts(mapped);
    }
    initialLoadRef.current = false;
    setLoading(false);
  }, [dataClientSlug]);

  useEffect(() => {
    initialLoadRef.current = true;
    setLoading(true);
    void load();

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => void load(), 20_000);
    const channel = supabase
      .channel(`crm-contacts-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_contacts" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load, dataClientSlug]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setRole("");
    setSource(CRM_SOURCE_OPTIONS[0]);
    setNotes("");
    setNameError("");
    setModalOpen(true);
  };

  const openEdit = (c: CrmContact) => {
    setEditingId(c.id);
    setName(c.name);
    setCompany(c.company ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setRole(c.role ?? "");
    setSource(normalizeContactSource(c.source));
    setNotes(c.notes ?? "");
    setNameError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setNameError("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name is required.");
      return;
    }
    const payload = {
      name: trimmed,
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      role: role.trim() || null,
      source: source || null,
      notes: notes.trim() || null,
      client_slug: contactClientSlug,
    };
    if (editingId) {
      const { data, error } = await supabase
        .from("crm_contacts")
        .update(payload)
        .eq("id", editingId)
        .select("*")
        .maybeSingle();
      if (error) {
        console.error("[crm contacts] update", error.message);
        return;
      }
      if (data) {
        const row = mapCrmContactRow(data as Record<string, unknown>);
        setContacts((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      }
    } else {
      const { data, error } = await supabase.from("crm_contacts").insert(payload).select("*").maybeSingle();
      if (error) {
        console.error("[crm contacts] insert", error.message);
        return;
      }
      if (data) {
        setContacts((prev) => [mapCrmContactRow(data as Record<string, unknown>), ...prev]);
      }
    }
    closeModal();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("crm_contacts").delete().eq("id", deleteId);
    if (error) console.error("[crm contacts] delete", error.message);
    else setContacts((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleteId(null);
  };

  const empty = !loading && contacts.length === 0;

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title={lt("CONTACTS")}
        subtitle={lt("All contacts and companies")}
        action={
          <button type="button" onClick={openCreate} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {lt("Add Contact")}
          </button>
        }
      />

      {loading && contacts.length === 0 ? (
        <p className="text-sm text-[rgba(255,255,255,0.45)]">{lt("Loading contacts…")}</p>
      ) : empty ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[#161616] px-6 py-16 text-center">
          <p className="text-sm text-[rgba(255,255,255,0.55)]">{lt("No contacts yet — add your first contact")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[#161616]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                <th className="px-4 py-3 font-normal">{lt("Name")}</th>
                <th className="px-4 py-3 font-normal">{lt("Company")}</th>
                <th className="px-4 py-3 font-normal">{lt("Email")}</th>
                <th className="px-4 py-3 font-normal">{lt("Phone")}</th>
                <th className="px-4 py-3 font-normal">{lt("Role")}</th>
                <th className="px-4 py-3 font-normal">{lt("Source")}</th>
                <th className="px-4 py-3 font-normal">{lt("Created")}</th>
                <th className="px-4 py-3 font-normal text-right">{lt("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] text-white last:border-0">
                  <td className="px-4 py-3 font-normal">{c.name}</td>
                  <td className="px-4 py-3 text-[rgba(255,255,255,0.75)]">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-[rgba(255,255,255,0.75)]">{c.email ?? "—"}</td>
                  <td className="mono-num px-4 py-3 text-[rgba(255,255,255,0.75)]">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-[rgba(255,255,255,0.75)]">{c.role ?? "—"}</td>
                  <td className="px-4 py-3 text-[rgba(255,255,255,0.75)]">
                    {c.source ? crmSourceLabel(c.source, language) : "—"}
                  </td>
                  <td className="mono-num px-4 py-3 text-[rgba(255,255,255,0.55)]">{formatCreated(c.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="mr-3 text-xs text-[#ff9a66] hover:underline"
                    >
                      {lt("Edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(c.id)}
                      className="text-xs text-[#fca5a5] hover:underline"
                    >
                      {lt("Delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">
                {editingId ? lt("Edit Contact") : lt("Add Contact")}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
              >
                {lt("Close")}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Name *")}</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  required
                />
                {nameError ? <p className="text-xs text-[#f87171]">{nameError}</p> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Company")}</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
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
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Role")}</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Source")}</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  {CRM_SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {crmSourceLabel(s, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Notes")}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Cancel")}
              </button>
              <button type="submit" className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <DeleteConfirmModal
        open={deleteId != null}
        title={lt("Delete contact")}
        message={lt("Remove this contact? This cannot be undone.")}
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function normalizeContactSource(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (CRM_SOURCE_OPTIONS.includes(s as (typeof CRM_SOURCE_OPTIONS)[number])) return s;
  return "Other";
}
