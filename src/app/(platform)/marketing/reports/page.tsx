"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, File, FileImage, FileText, FileVideo, Folder, MoreHorizontal, X } from "lucide-react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import { MarketingAccessGuard } from "../_components/marketing-access-guard";

type MarketingFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  folderId: string | null;
};

type MarketingFolder = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  files: MarketingFile[];
};

type OpenMenu = { type: "folder"; id: string } | { type: "file"; id: string } | null;

function fileKind(type: string) {
  const ext = type.toLowerCase();
  if (ext === "pdf") return "pdf" as const;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image" as const;
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video" as const;
  return "other" as const;
}

function fileIcon(type: string) {
  const kind = fileKind(type);
  if (kind === "pdf") return <FileText className="h-8 w-8 text-[#ef4444]" strokeWidth={1.5} />;
  if (kind === "image") return <FileImage className="h-8 w-8 text-[#22c55e]" strokeWidth={1.5} />;
  if (kind === "video") return <FileVideo className="h-8 w-8 text-[#3b82f6]" strokeWidth={1.5} />;
  return <File className="h-8 w-8 text-[#9ca3af]" strokeWidth={1.5} />;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MarketingReportsPage() {
  const { currentUser, t } = useAppContext();
  const { t: lt } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<MarketingFolder[]>([]);
  const [rootFiles, setRootFiles] = useState<MarketingFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const [viewerFile, setViewerFile] = useState<MarketingFile | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<MarketingFile | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MarketingFolder | null>(null);
  const [filter, setFilter] = useState<"all" | "pdf" | "image" | "video" | "other">("all");

  useEffect(() => {
    let mounted = true;
    void Promise.all([supabase.from("marketing_folders").select("*"), supabase.from("marketing_files").select("*")])
      .then(([foldersRes, filesRes]) => {
        if (!mounted) return;
        if (foldersRes.error) console.error("[supabase] marketing_folders fetch failed:", foldersRes.error.message);
        if (filesRes.error) console.error("[supabase] marketing_files fetch failed:", filesRes.error.message);
        const files: MarketingFile[] = ((filesRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          type: String(row.type ?? "file"),
          size: Number(row.size ?? 0) || 0,
          uploadedAt: String(row.created_at ?? ""),
          uploadedBy: String(row.uploaded_by ?? ""),
          url: String(row.url ?? ""),
          folderId: row.folder_id ? String(row.folder_id) : null,
        }));
        const mappedFolders: MarketingFolder[] = ((foldersRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          createdAt: String(row.created_at ?? ""),
          createdBy: String(row.created_by ?? ""),
          files: files.filter((file) => file.folderId === String(row.id ?? "")),
        }));
        setFolders(mappedFolders);
        setRootFiles(files.filter((file) => file.folderId == null));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentFolder = useMemo(() => folders.find((folder) => folder.id === currentFolderId) ?? null, [folders, currentFolderId]);
  const visibleFiles = useMemo(() => {
    const source = currentFolder ? currentFolder.files : rootFiles;
    if (filter === "all") return source;
    return source.filter((file) => fileKind(file.type) === filter);
  }, [currentFolder, rootFiles, filter]);

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const folder: MarketingFolder = { id, name, createdAt: now, createdBy: currentUser.name, files: [] };
    setFolders((prev) => [folder, ...prev]);
    void supabase.from("marketing_folders").insert({ id, name, created_by: currentUser.name });
    setNewFolderOpen(false);
    setNewFolderName("");
  };

  const confirmUpload = () => {
    if (!pendingUploadFile) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const file: MarketingFile = {
      id,
      name: pendingUploadFile.name,
      type: pendingUploadFile.name.split(".").pop()?.toLowerCase() ?? "file",
      size: pendingUploadFile.size,
      uploadedAt: now,
      uploadedBy: currentUser.name,
      url: URL.createObjectURL(pendingUploadFile),
      folderId: currentFolderId,
    };
    if (currentFolderId) {
      setFolders((prev) => prev.map((folder) => (folder.id === currentFolderId ? { ...folder, files: [file, ...folder.files] } : folder)));
    } else {
      setRootFiles((prev) => [file, ...prev]);
    }
    void supabase.from("marketing_files").insert({
      id,
      name: file.name,
      type: file.type,
      size: String(file.size),
      folder_id: file.folderId,
      uploaded_by: file.uploadedBy,
      url: file.url,
    });
    setUploadConfirmOpen(false);
    setPendingUploadFile(null);
  };

  const deleteFile = () => {
    if (!deleteFileTarget) return;
    if (deleteFileTarget.folderId) {
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === deleteFileTarget.folderId
            ? { ...folder, files: folder.files.filter((file) => file.id !== deleteFileTarget.id) }
            : folder,
        ),
      );
    } else {
      setRootFiles((prev) => prev.filter((file) => file.id !== deleteFileTarget.id));
    }
    void supabase.from("marketing_files").delete().eq("id", deleteFileTarget.id);
    setDeleteFileTarget(null);
  };

  const deleteFolder = () => {
    if (!deleteFolderTarget) return;
    setFolders((prev) => prev.filter((folder) => folder.id !== deleteFolderTarget.id));
    if (currentFolderId === deleteFolderTarget.id) setCurrentFolderId(null);
    void supabase.from("marketing_folders").delete().eq("id", deleteFolderTarget.id);
    setDeleteFolderTarget(null);
  };

  const downloadFile = (file: MarketingFile) => {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <ModuleGuard module="marketing">
      <MarketingAccessGuard>
        <PageHeader
          title={t("marketing")}
          subtitle={lt("Marketing reports folder structure with uploads, previews and downloads.")}
          action={
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewFolderOpen(true)} className="btn-ghost rounded-lg px-3 py-2 text-sm">{lt("New Folder")}</button>
              <button type="button" onClick={() => filePickerRef.current?.click()} className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Upload File")}</button>
              <input ref={filePickerRef} type="file" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                setPendingUploadFile(file);
                setUploadConfirmOpen(true);
                e.target.value = "";
              }} />
            </div>
          }
        />

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <button type="button" onClick={() => setCurrentFolderId(null)}>{lt("Marketing Reports")}</button>
            {currentFolder ? <><span>/</span><span>{currentFolder.name}</span></> : null}
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs text-white">
            <option value="all">{lt("All categories")}</option>
            <option value="pdf">PDF</option>
            <option value="image">{lt("Images")}</option>
            <option value="video">{lt("Videos")}</option>
            <option value="other">{lt("Other")}</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-[140px] animate-pulse rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616]" />)}
          </div>
        ) : currentFolder ? (
          visibleFiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleFiles.map((file) => (
                <Card key={file.id} className="group relative rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616] p-4">
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-md p-1 text-[rgba(255,255,255,0.5)] opacity-0 transition group-hover:opacity-100"
                    onClick={() => setOpenMenu((prev) => (prev?.type === "file" && prev.id === file.id ? null : { type: "file", id: file.id }))}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openMenu?.type === "file" && openMenu.id === file.id ? (
                    <div className="absolute right-3 top-11 z-10 min-w-[120px] rounded-md border border-[rgba(255,255,255,0.08)] bg-[#222222] p-1">
                      <button type="button" onClick={() => setViewerFile(file)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]">{lt("View")}</button>
                      <button type="button" onClick={() => downloadFile(file)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]">{lt("Download")}</button>
                      <button type="button" onClick={() => setDeleteFileTarget(file)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]">{lt("Delete")}</button>
                    </div>
                  ) : null}
                  {fileIcon(file.type)}
                  <p className="mt-3 truncate text-sm text-white">{file.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatBytes(file.size)}</p>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] text-sm text-[rgba(255,255,255,0.7)]">{lt("This folder is empty. Upload a file to get started.")}</div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {folders.map((folder) => (
              <Card key={folder.id} className="group relative cursor-pointer rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616] p-4" onClick={() => setCurrentFolderId(folder.id)}>
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-md p-1 text-[rgba(255,255,255,0.5)] opacity-0 transition group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenu((prev) => (prev?.type === "folder" && prev.id === folder.id ? null : { type: "folder", id: folder.id }));
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {openMenu?.type === "folder" && openMenu.id === folder.id ? (
                  <div className="absolute right-3 top-11 z-10 min-w-[120px] rounded-md border border-[rgba(255,255,255,0.08)] bg-[#222222] p-1">
                    <button type="button" onClick={() => setDeleteFolderTarget(folder)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]">{lt("Delete")}</button>
                  </div>
                ) : null}
                <Folder className="h-8 w-8 fill-[rgba(255,165,0,0.6)] text-[rgba(255,165,0,0.6)]" strokeWidth={1.6} />
                <p className="mt-3 text-sm text-white">{folder.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{folder.files.length} {lt("files")}</p>
              </Card>
            ))}
            {visibleFiles.map((file) => (
              <Card key={file.id} className="rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616] p-4">
                {fileIcon(file.type)}
                <p className="mt-3 truncate text-sm text-white">{file.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatBytes(file.size)}</p>
              </Card>
            ))}
          </div>
        )}

        {newFolderOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
            <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
              <h3 className="text-lg text-white">{lt("New Folder")}</h3>
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="mt-3 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setNewFolderOpen(false)} className="btn-ghost rounded-lg px-3 py-2 text-sm">{lt("Cancel")}</button>
                <button type="button" onClick={createFolder} className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Confirm")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {uploadConfirmOpen && pendingUploadFile ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
            <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
              <h3 className="text-lg text-white">{lt("Confirm Upload")}</h3>
              <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">{pendingUploadFile.name}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setUploadConfirmOpen(false)} className="btn-ghost rounded-lg px-3 py-2 text-sm">{lt("Cancel")}</button>
                <button type="button" onClick={confirmUpload} className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Confirm")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteFileTarget ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
            <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
              <h3 className="text-lg text-white">{lt("Delete file")}</h3>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteFileTarget(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">{lt("Cancel")}</button>
                <button type="button" onClick={deleteFile} className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Confirm")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteFolderTarget ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
            <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
              <h3 className="text-lg text-white">{lt("Delete folder")}</h3>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteFolderTarget(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">{lt("Cancel")}</button>
                <button type="button" onClick={deleteFolder} className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Confirm")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {viewerFile && fileKind(viewerFile.type) === "pdf" ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
              <p className="truncate text-sm text-white">{viewerFile.name}</p>
              <button type="button" onClick={() => setViewerFile(null)} className="btn-ghost rounded-lg px-2 py-1 text-xs">{lt("Close")}</button>
            </div>
            <iframe title={viewerFile.name} src={viewerFile.url} className="h-full w-full border-0" />
          </div>
        ) : null}

        {viewerFile && fileKind(viewerFile.type) === "image" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4">
            <div className="relative w-full max-w-5xl">
              <button type="button" onClick={() => setViewerFile(null)} className="absolute right-2 top-2 rounded-md border border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.65)] p-1.5 text-white">
                <X className="h-4 w-4" />
              </button>
              <img src={viewerFile.url} alt={viewerFile.name} className="max-h-[85vh] w-full object-contain" />
            </div>
          </div>
        ) : null}

        {viewerFile && fileKind(viewerFile.type) === "video" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4">
            <div className="w-full max-w-4xl rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="truncate text-sm text-white">{viewerFile.name}</p>
                <button type="button" onClick={() => setViewerFile(null)} className="btn-ghost rounded-lg px-2 py-1 text-xs">{lt("Close")}</button>
              </div>
              <video src={viewerFile.url} controls className="h-auto w-full rounded-[6px]" />
            </div>
          </div>
        ) : null}
      </MarketingAccessGuard>
    </ModuleGuard>
  );
}
