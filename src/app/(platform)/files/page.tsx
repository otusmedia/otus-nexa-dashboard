"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  File,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";

type DriveFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  folderId: string | null;
};

type DriveFolder = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  files: DriveFile[];
};

type OpenMenu =
  | { type: "folder"; id: string }
  | { type: "file"; id: string }
  | null;

const initialFolders: DriveFolder[] = [];

const initialRootFiles: DriveFile[] = [];

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function detectType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "file";
  return ext;
}

function getFileKind(type: string) {
  const ext = type.toLowerCase();
  if (ext === "pdf") return "pdf" as const;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image" as const;
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video" as const;
  return "other" as const;
}

function fileIcon(type: string) {
  const kind = getFileKind(type);
  if (kind === "pdf") return <FileText className="h-8 w-8 text-[#ef4444]" strokeWidth={1.5} />;
  if (kind === "image") return <FileImage className="h-8 w-8 text-[#22c55e]" strokeWidth={1.5} />;
  if (kind === "video") return <FileVideo className="h-8 w-8 text-[#3b82f6]" strokeWidth={1.5} />;
  return <File className="h-8 w-8 text-[#9ca3af]" strokeWidth={1.5} />;
}

export default function FilesPage() {
  const { currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [folders, setFolders] = useState<DriveFolder[]>(initialFolders);
  const [rootFiles, setRootFiles] = useState<DriveFile[]>(initialRootFiles);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState("");

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  const [viewerFile, setViewerFile] = useState<DriveFile | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<DriveFile | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<DriveFolder | null>(null);
  const [inlineError, setInlineError] = useState("");

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt)),
    [folders],
  );

  const sortedRootFiles = useMemo(
    () => [...rootFiles].sort((a, b) => parseDate(b.uploadedAt) - parseDate(a.uploadedAt)),
    [rootFiles],
  );

  const currentFolder = useMemo(
    () => folders.find((folder) => folder.id === currentFolderId) ?? null,
    [folders, currentFolderId],
  );

  const currentFolderFiles = useMemo(() => {
    if (!currentFolder) return [];
    return [...currentFolder.files].sort((a, b) => parseDate(b.uploadedAt) - parseDate(a.uploadedAt));
  }, [currentFolder]);

  useEffect(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (!viewerFile) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerFile(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [viewerFile]);

  const stopMenuClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const downloadFile = (file: DriveFile) => {
    const anchor = document.createElement("a");
    anchor.href = file.url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setNewFolderError("Folder name is required");
      return;
    }
    const now = new Date().toISOString().slice(0, 10);
    setFolders((prev) => [
      {
        id: `fld-${crypto.randomUUID()}`,
        name: trimmed,
        createdAt: now,
        createdBy: currentUser.name,
        files: [],
      },
      ...prev,
    ]);
    setNewFolderOpen(false);
    setNewFolderName("");
    setNewFolderError("");
  };

  const startRenameFolder = (folder: DriveFolder) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
    setOpenMenu(null);
  };

  const commitRenameFolder = (folderId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingFolderId(null);
      setRenameValue("");
      return;
    }
    setFolders((prev) => prev.map((folder) => (folder.id === folderId ? { ...folder, name: trimmed } : folder)));
    setRenamingFolderId(null);
    setRenameValue("");
  };

  const tryDeleteFolder = (folder: DriveFolder) => {
    if (folder.files.length > 0) {
      setInlineError("Remove all files before deleting this folder");
      setOpenMenu(null);
      return;
    }
    setDeleteFolderTarget(folder);
    setOpenMenu(null);
  };

  const onSelectUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setPendingUploadFile(file);
    setUploadConfirmOpen(true);
    event.target.value = "";
  };

  const confirmUpload = () => {
    if (!pendingUploadFile) return;
    const now = new Date().toISOString().slice(0, 10);
    const next: DriveFile = {
      id: `fil-${crypto.randomUUID()}`,
      name: pendingUploadFile.name,
      type: detectType(pendingUploadFile.name),
      size: pendingUploadFile.size,
      uploadedAt: now,
      uploadedBy: currentUser.name,
      url: URL.createObjectURL(pendingUploadFile),
      folderId: currentFolderId,
    };

    if (currentFolderId) {
      setFolders((prev) =>
        prev.map((folder) => (folder.id === currentFolderId ? { ...folder, files: [next, ...folder.files] } : folder)),
      );
    } else {
      setRootFiles((prev) => [next, ...prev]);
    }

    setUploadConfirmOpen(false);
    setPendingUploadFile(null);
  };

  const confirmDeleteFile = () => {
    if (!deleteFileTarget) return;
    if (deleteFileTarget.url.startsWith("blob:")) {
      URL.revokeObjectURL(deleteFileTarget.url);
    }
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
    setDeleteFileTarget(null);
  };

  const confirmDeleteFolder = () => {
    if (!deleteFolderTarget) return;
    setFolders((prev) => prev.filter((folder) => folder.id !== deleteFolderTarget.id));
    if (currentFolderId === deleteFolderTarget.id) {
      setCurrentFolderId(null);
    }
    setDeleteFolderTarget(null);
  };

  const renderFolderCard = (folder: DriveFolder) => {
    const isRenaming = renamingFolderId === folder.id;
    return (
      <Card
        key={folder.id}
        onClick={() => {
          if (!isRenaming) setCurrentFolderId(folder.id);
        }}
        className="group relative cursor-pointer rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616] p-4"
      >
        <button
          type="button"
          onClick={(event) => {
            stopMenuClick(event);
            setOpenMenu((prev) =>
              prev?.type === "folder" && prev.id === folder.id ? null : { type: "folder", id: folder.id },
            );
          }}
          className="absolute right-3 top-3 rounded-md p-1 text-[rgba(255,255,255,0.5)] opacity-0 transition hover:bg-[rgba(255,255,255,0.06)] group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {openMenu?.type === "folder" && openMenu.id === folder.id ? (
          <div
            className="absolute right-3 top-11 z-10 min-w-[120px] rounded-md border border-[rgba(255,255,255,0.08)] bg-[#222222] p-1"
            onClick={stopMenuClick}
          >
            <button
              type="button"
              onClick={() => startRenameFolder(folder)}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {lt("Rename")}
            </button>
            <button
              type="button"
              onClick={() => tryDeleteFolder(folder)}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {lt("Delete")}
            </button>
          </div>
        ) : null}

        <Folder className="h-8 w-8 fill-[rgba(255,165,0,0.6)] text-[rgba(255,165,0,0.6)]" strokeWidth={1.6} />

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => commitRenameFolder(folder.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRenameFolder(folder.id);
              }
            }}
            className="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm text-white"
          />
        ) : (
          <p className="mt-3 text-sm font-normal text-white">{folder.name}</p>
        )}

        <p className="mt-1 text-[0.75rem] text-[rgba(255,255,255,0.4)]">
          {folder.files.length} {folder.files.length === 1 ? lt("file") : lt("files")}
        </p>
        <p className="mt-1 text-[0.72rem] text-[rgba(255,255,255,0.4)]">
          {lt("Created by:")} {folder.createdBy}
        </p>
      </Card>
    );
  };

  const renderFileCard = (file: DriveFile) => {
    return (
      <Card key={file.id} className="group relative rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616] p-4">
        <button
          type="button"
          onClick={(event) => {
            stopMenuClick(event);
            setOpenMenu((prev) =>
              prev?.type === "file" && prev.id === file.id ? null : { type: "file", id: file.id },
            );
          }}
          className="absolute right-3 top-3 rounded-md p-1 text-[rgba(255,255,255,0.5)] opacity-0 transition hover:bg-[rgba(255,255,255,0.06)] group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {openMenu?.type === "file" && openMenu.id === file.id ? (
          <div
            className="absolute right-3 top-11 z-10 min-w-[120px] rounded-md border border-[rgba(255,255,255,0.08)] bg-[#222222] p-1"
            onClick={stopMenuClick}
          >
            <button
              type="button"
              onClick={() => {
                setViewerFile(file);
                setOpenMenu(null);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {lt("View")}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadFile(file);
                setOpenMenu(null);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {lt("Download")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteFileTarget(file);
                setOpenMenu(null);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-[rgba(255,255,255,0.08)]"
            >
              {lt("Delete")}
            </button>
          </div>
        ) : null}

        {fileIcon(file.type)}
        <p className="mt-3 truncate text-sm font-normal text-white">{file.name}</p>
        <p className="mt-1 text-[0.75rem] text-[rgba(255,255,255,0.4)]">
          <span className="mono-num">{formatBytes(file.size)}</span>
        </p>
        <p className="mt-1 text-[0.72rem] text-[rgba(255,255,255,0.4)]">
          {lt("Uploaded by:")} {file.uploadedBy} · <span className="mono-num">{file.uploadedAt}</span>
        </p>
      </Card>
    );
  };

  const viewerKind = viewerFile ? getFileKind(viewerFile.type) : null;

  return (
    <ModuleGuard module="files">
      <PageHeader
        title={lt("FILES")}
        subtitle={lt("Project folder structure with upload, rename and delete controls")}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setNewFolderOpen(true);
                setNewFolderError("");
              }}
              className="btn-ghost rounded-lg px-3 py-2 text-sm"
            >
              {lt("New Folder")}
            </button>
            <button
              type="button"
              onClick={() => filePickerRef.current?.click()}
              className="btn-primary rounded-lg px-3 py-2 text-sm"
            >
              {lt("Upload File")}
            </button>
            <input ref={filePickerRef} type="file" className="hidden" onChange={onSelectUploadFile} />
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-[rgba(255,255,255,0.4)]">
        <button type="button" className="hover:text-white" onClick={() => setCurrentFolderId(null)}>
          {lt("Files")}
        </button>
        {currentFolder ? (
          <>
            <span className="text-[rgba(255,255,255,0.4)]">/</span>
            <button type="button" className="hover:text-white" onClick={() => setCurrentFolderId(currentFolder.id)}>
              {currentFolder.name}
            </button>
          </>
        ) : null}
      </div>

      {inlineError ? (
        <p className="mb-3 rounded-[8px] border border-[#ef4444]/40 bg-[#2b1111] px-3 py-2 text-xs text-[#fca5a5]">{lt(inlineError)}</p>
      ) : null}

      {currentFolder ? (
        currentFolderFiles.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {currentFolderFiles.map((file) => renderFileCard(file))}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] text-center">
            <Folder className="h-9 w-9 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">{lt("This folder is empty. Upload a file to get started.")}</p>
          </div>
        )
      ) : sortedFolders.length || sortedRootFiles.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sortedFolders.map((folder) => renderFolderCard(folder))}
          {sortedRootFiles.map((file) => renderFileCard(file))}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] text-center">
          <Folder className="h-10 w-10 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">{lt("No files yet. Create a folder or upload a file.")}</p>
        </div>
      )}

      {newFolderOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
            <h3 className="text-lg font-normal text-white">{lt("New Folder")}</h3>
            <input
              autoFocus
              value={newFolderName}
              onChange={(event) => {
                setNewFolderName(event.target.value);
                if (newFolderError) setNewFolderError("");
              }}
              placeholder={lt("Folder name")}
              className="mt-3 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
            />
            {newFolderError ? <p className="mt-2 text-xs text-[#fca5a5]">{lt(newFolderError)}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                  setNewFolderError("");
                }}
                className="btn-ghost rounded-lg px-3 py-2 text-sm"
              >
                {lt("Cancel")}
              </button>
              <button type="button" onClick={handleCreateFolder} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadConfirmOpen && pendingUploadFile ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
            <h3 className="text-lg font-normal text-white">{lt("Confirm Upload")}</h3>
            <div className="mt-3 space-y-2 text-sm text-[rgba(255,255,255,0.7)]">
              <p>
                {lt("File: ")}
                <span className="text-white">{pendingUploadFile.name}</span>
              </p>
              <p>
                {lt("Size: ")}
                <span className="mono-num text-white">{formatBytes(pendingUploadFile.size)}</span>
              </p>
              <p>
                {lt("Destination: ")}
                <span className="text-white">{currentFolder?.name ?? lt("Root")}</span>
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadConfirmOpen(false);
                  setPendingUploadFile(null);
                }}
                className="btn-ghost rounded-lg px-3 py-2 text-sm"
              >
                {lt("Cancel")}
              </button>
              <button type="button" onClick={confirmUpload} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteFileTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
            <h3 className="text-lg font-normal text-white">{lt("Delete file")}</h3>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">
              {lt("Are you sure you want to delete ")}
              {deleteFileTarget.name}
              {lt("? This action cannot be undone.")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteFileTarget(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">
                {lt("Cancel")}
              </button>
              <button type="button" onClick={confirmDeleteFile} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteFolderTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.8)] p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
            <h3 className="text-lg font-normal text-white">{lt("Delete folder")}</h3>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">
              {lt("Are you sure you want to delete ")}
              {deleteFolderTarget.name}
              {lt("? This action cannot be undone.")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteFolderTarget(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">
                {lt("Cancel")}
              </button>
              <button type="button" onClick={confirmDeleteFolder} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerFile && viewerKind === "pdf" ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
            <p className="truncate text-sm text-white">{viewerFile.name}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadFile(viewerFile)}
                className="btn-ghost inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                {lt("Download")}
              </button>
              <button type="button" onClick={() => setViewerFile(null)} className="btn-ghost rounded-lg px-2 py-1 text-xs">
                {lt("Close")}
              </button>
            </div>
          </div>
          <iframe title={viewerFile.name} src={viewerFile.url} className="h-full w-full border-0" />
        </div>
      ) : null}

      {viewerFile && viewerKind === "image" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setViewerFile(null)}
              className="absolute right-2 top-2 rounded-md border border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.65)] p-1.5 text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={viewerFile.url} alt={viewerFile.name} className="max-h-[85vh] w-full object-contain" />
          </div>
        </div>
      ) : null}

      {viewerFile && viewerKind === "video" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4">
          <div className="w-full max-w-4xl rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="truncate text-sm text-white">{viewerFile.name}</p>
              <button type="button" onClick={() => setViewerFile(null)} className="btn-ghost rounded-lg px-2 py-1 text-xs">
                {lt("Close")}
              </button>
            </div>
            <video src={viewerFile.url} controls className="h-auto w-full rounded-[6px]" />
          </div>
        </div>
      ) : null}

      {viewerFile && viewerKind === "other" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[var(--surface)] p-4">
            <h3 className="text-lg font-normal text-white">{viewerFile.name}</h3>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.7)]">{lt("Preview not available")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setViewerFile(null)} className="btn-ghost rounded-lg px-3 py-2 text-sm">
                {lt("Close")}
              </button>
              <button type="button" onClick={() => downloadFile(viewerFile)} className="btn-primary rounded-lg px-3 py-2 text-sm">
                {lt("Download")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModuleGuard>
  );
}
