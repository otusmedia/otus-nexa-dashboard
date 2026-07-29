"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { resolveAccountForSession } from "@/lib/accounts";
import { getSessionAppOrigin } from "@/lib/app-url";
import {
  effectiveUserClientSlug,
  isAgencyCompany,
  isClientCompany,
} from "@/lib/client-utils";
import {
  createMoodboardFromTemplate,
  deleteMoodboard,
  listMoodboards,
  moodboardPublicPath,
  type MoodboardSummary,
} from "@/lib/moodboard";

export default function MoodboardListPage() {
  const router = useRouter();
  const { currentUser, projectsClientFilter, dataClientSlug, clients } = useAppContext();
  const { t: lt } = useLanguage();
  const [boards, setBoards] = useState<MoodboardSummary[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isAgency = isAgencyCompany(currentUser.company);
  const isClient = isClientCompany(currentUser.company);

  const preferredSlug = useMemo(() => {
    if (isAgency) {
      return projectsClientFilter !== "all" ? projectsClientFilter : dataClientSlug;
    }
    return effectiveUserClientSlug(currentUser) || dataClientSlug;
  }, [isAgency, currentUser, projectsClientFilter, dataClientSlug]);

  const clientName = useMemo(() => {
    if (!preferredSlug || preferredSlug === "all") return "Novo Moodboard";
    return clients.find((c) => c.slug === preferredSlug)?.name ?? preferredSlug;
  }, [clients, preferredSlug]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const account = await resolveAccountForSession(currentUser, preferredSlug);
      if (!account) {
        setAccountId(null);
        setBoards([]);
        setError(
          isAgency && (!preferredSlug || preferredSlug === "all")
            ? lt("Select a client in the sidebar to edit their moodboard.")
            : lt("No account found for this session."),
        );
        return;
      }
      setAccountId(account.id);
      const list = await listMoodboards(account.id);
      setBoards(isClient ? list.filter((b) => Boolean(b.publishedAt)) : list);
    } catch (err) {
      setError(err instanceof Error ? err.message : lt("Could not load moodboard."));
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, preferredSlug, isAgency, isClient, lt]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const publicUrlFor = (board: MoodboardSummary) => {
    if (!board.shareSlug) return null;
    return `${getSessionAppOrigin()}${moodboardPublicPath(board.shareSlug)}`;
  };

  const handleCreate = async () => {
    if (!accountId || !isAgency) return;
    setCreating(true);
    setError("");
    try {
      const board = await createMoodboardFromTemplate(accountId, {
        name: clientName,
        title: clientName,
      });
      router.push(`/moodboard/${board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : lt("Could not save."));
      setCreating(false);
    }
  };

  const handleOpen = (board: MoodboardSummary) => {
    if (isClient) {
      const url = publicUrlFor(board);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(`/moodboard/${board.id}`);
  };

  const handleDelete = async (board: MoodboardSummary) => {
    if (!isAgency) return;
    if (!window.confirm(`Excluir “${board.name}”?`)) return;
    try {
      await deleteMoodboard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : lt("Could not save."));
    }
  };

  return (
    <ModuleGuard module="moodboard">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{lt("Moodboard")}</h1>
            <p className="mt-1 text-sm text-white/45">
              {isClient
                ? "Abra o moodboard publicado em uma nova aba."
                : "Crie a partir do template e edite antes de publicar."}
            </p>
          </div>
          {isAgency ? (
            <button
              type="button"
              disabled={creating || !accountId}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ff4500] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Criando…" : "Criar moodboard"}
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mb-4 rounded-md bg-[#2b1111] px-3 py-2 text-sm text-[#fca5a5]">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-white/45">{lt("Loading…")}</p>
        ) : boards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/12 px-6 py-16 text-center text-sm text-white/40">
            {isAgency
              ? "Nenhum moodboard ainda. Crie um a partir do template padrão."
              : "Nenhum moodboard publicado ainda."}
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {boards.map((board) => {
              const url = publicUrlFor(board);
              return (
                <li key={board.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => handleOpen(board)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-white/90">
                      {board.title || board.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/40">
                      {board.subtitle || "MoodBoard & Direção Visual"}
                      {board.publishedAt ? " · Publicado" : " · Rascunho"}
                      {` · ${board.itemCount} imagens`}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {url && board.publishedAt ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[0.7rem] text-white/55 hover:text-white"
                        title={url}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </a>
                    ) : null}
                    {isAgency ? (
                      <>
                        <Link
                          href={`/moodboard/${board.id}`}
                          className="rounded-md border border-white/10 px-2.5 py-1.5 text-[0.7rem] text-white/55 hover:text-white"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(board)}
                          className="rounded-md p-1.5 text-white/35 hover:bg-white/5 hover:text-white/80"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModuleGuard>
  );
}
