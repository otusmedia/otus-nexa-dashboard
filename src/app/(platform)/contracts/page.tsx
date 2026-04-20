"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import type { ContractItem } from "@/types";
import { cn } from "@/lib/utils";

const DELETE_PASSKEY = "DELETE";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadPdf(url: string, fileName: string) {
  const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function statusBadgeClasses(status: ContractItem["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-500/35 bg-emerald-950/35 text-emerald-400";
    case "draft":
      return "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--muted)]";
    case "expired":
      return "border-red-500/35 bg-red-950/35 text-red-400";
    default:
      return "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]";
  }
}

export default function ContractsPage() {
  const { contracts, uploadContract, deleteContract, currentUser, t, ts } = useAppContext();
  const { t: lt } = useLanguage();
  const isAdmin = currentUser.role === "admin";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<ContractItem["status"]>("active");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewerContract, setViewerContract] = useState<ContractItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractItem | null>(null);
  const [passkey, setPasskey] = useState("");
  const [passkeyError, setPasskeyError] = useState(false);

  const resetUploadForm = useCallback(() => {
    setUploadFile(null);
    setUploadName("");
    setUploadStatus("active");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadFile(null);
      setUploadName("");
      return;
    }
    const okPdf =
      file.name.toLowerCase().endsWith(".pdf") &&
      (file.type === "application/pdf" || file.type === "" || file.type === "application/x-pdf");
    if (!okPdf) {
      e.target.value = "";
      setUploadFile(null);
      setUploadName("");
      return;
    }
    setUploadFile(file);
    setUploadName(file.name);
  };

  const submitUpload = () => {
    if (!uploadFile || !uploadName.trim()) return;
    const fileUrl = URL.createObjectURL(uploadFile);
    uploadContract({
      name: uploadName.trim(),
      status: uploadStatus,
      fileUrl,
      fileSizeBytes: uploadFile.size,
    });
    setUploadOpen(false);
    resetUploadForm();
  };

  const openDeleteFlow = (contract: ContractItem) => {
    setDeleteTarget(contract);
    setPasskey("");
    setPasskeyError(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (passkey !== DELETE_PASSKEY) {
      setPasskeyError(true);
      return;
    }
    deleteContract(deleteTarget.id);
    if (viewerContract?.id === deleteTarget.id) setViewerContract(null);
    setDeleteTarget(null);
    setPasskey("");
    setPasskeyError(false);
  };

  useEffect(() => {
    if (!viewerContract) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerContract(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerContract]);

  return (
    <ModuleGuard module="contracts">
      <PageHeader
        title={t("contracts")}
        subtitle={lt(
          "PDF contracts — upload, view, and download. Admins can remove files after passkey confirmation.",
        )}
        action={
          <button type="button" onClick={openUpload} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {t("uploadContract")}
          </button>
        }
      />

      <div className="space-y-2">
        {contracts.map((contract) => (
          <Card
            key={contract.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-normal text-[var(--text)]">{contract.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {lt("Uploaded")}{" "}
                  <span className="mono-num">{contract.uploadDate}</span>
                  {" · "}
                  <span className="mono-num">{formatFileSize(contract.fileSizeBytes)}</span>
                  {contract.pageCount != null ? (
                    <>
                      {" · "}
                      <span className="mono-num">{contract.pageCount}</span>{" "}
                      {contract.pageCount === 1 ? lt("page") : lt("pages")}
                    </>
                  ) : null}
                </p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-normal capitalize",
                    statusBadgeClasses(contract.status),
                  )}
                >
                  {ts(contract.status)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewerContract(contract)}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
              >
                {lt("View")}
              </button>
              <button
                type="button"
                onClick={() => downloadPdf(contract.fileUrl, contract.name)}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
              >
                {lt("Download")}
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => openDeleteFlow(contract)}
                  className="rounded-lg border border-red-500/35 bg-transparent px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-950/40"
                >
                  {lt("Delete")}
                </button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={uploadOpen} title={t("uploadContract")} onClose={() => setUploadOpen(false)} closeLabel={t("cancel")}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("PDF file")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onFileChange}
              className="w-full rounded-lg px-3 py-2 text-sm file:mr-3 file:rounded-md file:border file:border-[var(--border-strong)] file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--text)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{lt("Contract name")}</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder={lt("Contract name")}
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">{t("status")}</label>
            <select
              value={uploadStatus}
              onChange={(e) => setUploadStatus(e.target.value as ContractItem["status"])}
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="active">{ts("active")}</option>
              <option value="draft">{ts("draft")}</option>
              <option value="expired">{ts("expired")}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={submitUpload}
              disabled={!uploadFile || !uploadName.trim()}
              className="btn-primary rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lt("Upload")}
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              className="btn-ghost rounded-lg px-3 py-2 text-sm"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </Modal>

      {viewerContract ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.9)]"
          role="dialog"
          aria-modal="true"
          aria-label={lt("PDF viewer")}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <p className="min-w-0 truncate text-sm font-normal text-white">{viewerContract.name}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => downloadPdf(viewerContract.fileUrl, viewerContract.name)}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs text-[var(--text)]"
              >
                {lt("Download")}
              </button>
              <button
                type="button"
                onClick={() => setViewerContract(null)}
                className="inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-2 text-[var(--text)] transition hover:bg-[var(--surface)]"
                aria-label={lt("Close viewer")}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <iframe title={viewerContract.name} src={viewerContract.fileUrl} className="min-h-0 w-full flex-1 border-0 bg-[#0a0a0a]" />
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-contract-title"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="delete-contract-title" className="text-lg font-normal text-[var(--text)]">
              {lt("Delete contract")}
            </h3>
            <p className="mt-3 text-sm text-[var(--muted)]">{lt("This action is permanent and cannot be undone.")}</p>
            <label className="mt-4 block text-xs text-[var(--muted)]">{lt("Confirmation")}</label>
            <input
              value={passkey}
              onChange={(e) => {
                setPasskey(e.target.value);
                setPasskeyError(false);
              }}
              placeholder={lt("Enter passkey to confirm")}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              autoComplete="off"
            />
            {passkeyError ? <p className="mt-2 text-sm text-red-400">{lt("Incorrect passkey")}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setPasskey("");
                  setPasskeyError(false);
                }}
                className="btn-ghost rounded-lg px-3 py-2 text-sm"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg border border-transparent bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500"
              >
                {lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModuleGuard>
  );
}
