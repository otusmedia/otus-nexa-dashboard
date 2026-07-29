"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { MoodboardSite } from "@/components/moodboard/moodboard-site";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { getSessionAppOrigin } from "@/lib/app-url";
import { isAgencyCompany } from "@/lib/client-utils";
import {
  deleteMoodboardItemDraft,
  loadMoodboardSite,
  moodboardPublicPath,
  publishMoodboard,
  updateMoodboardPageDraft,
  upsertMoodboardItemDraft,
  type MoodboardSiteData,
} from "@/lib/moodboard";
import { readImageNaturalSize, uploadMoodboardMedia } from "@/lib/moodboard-upload";

export default function MoodboardEditorPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [site, setSite] = useState<MoodboardSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);

  const isAgency = isAgencyCompany(currentUser.company);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      if (!opts?.silent) setLoading(true);
      setError("");
      try {
        const data = await loadMoodboardSite(id, "draft");
        setSite(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : lt("Could not load moodboard."));
        if (!opts?.silent) setSite(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [id, lt],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const publicUrl = useMemo(() => {
    if (!site?.shareSlug) return null;
    return `${getSessionAppOrigin()}${moodboardPublicPath(site.shareSlug)}`;
  }, [site?.shareSlug]);

  if (!isAgency) {
    return (
      <ModuleGuard module="moodboard">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm text-white/60">
            Clientes abrem o moodboard pela lista, no link público.
          </p>
          <Link href="/moodboard" className="mt-4 inline-block text-sm text-[#ff4500] hover:underline">
            Voltar à lista
          </Link>
        </div>
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard module="moodboard">
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-white/45">
          {lt("Loading…")}
        </div>
      ) : error && !site ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm text-white/60">{error}</p>
          <Link href="/moodboard" className="mt-4 inline-block text-sm text-[#ff4500] hover:underline">
            Voltar à lista
          </Link>
        </div>
      ) : site ? (
        <div className="min-h-full bg-[oklch(97.5%_0_0)]">
          {error ? (
            <p className="bg-[#2b1111] px-4 py-2 text-center text-xs text-[#fca5a5]">{error}</p>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-white/80 px-4 py-2 backdrop-blur">
            <Link
              href="/moodboard"
              className="inline-flex items-center gap-1.5 text-[0.7rem] text-black/50 hover:text-black/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Lista
            </Link>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="rounded-md border border-black/10 px-2.5 py-1 text-[0.7rem] text-black/55 hover:text-black"
            >
              {preview ? lt("Back to edit") : lt("Preview as visitor")}
            </button>
          </div>
          <MoodboardSite
            mode={preview ? "view" : "edit"}
            data={site}
            publicUrl={publicUrl}
            publishing={publishing}
            publishSuccessLabel={lt("Published successfully")}
            viewLiveLabel={lt("Open live page")}
            readImageSize={readImageNaturalSize}
            onChangePage={async (patch) => {
              try {
                await updateMoodboardPageDraft(site.id, patch);
                setSite((prev) =>
                  prev
                    ? {
                        ...prev,
                        name: patch.name ?? prev.name,
                        page: { ...prev.page, ...patch },
                      }
                    : prev,
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : lt("Could not save."));
              }
            }}
            onUpload={async (folder, file) =>
              uploadMoodboardMedia(site.accountId, file, folder, site.id)
            }
            onAddItem={async (input) => {
              const item = await upsertMoodboardItemDraft(site.accountId, site.id, input);
              setSite((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));
            }}
            onDeleteItem={async (itemId) => {
              await deleteMoodboardItemDraft(site.id, itemId);
              setSite((prev) =>
                prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
              );
            }}
            onPublish={async () => {
              setPublishing(true);
              setError("");
              try {
                await publishMoodboard(site.id);
                await reload({ silent: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : lt("Could not publish."));
                throw err;
              } finally {
                setPublishing(false);
              }
            }}
          />
        </div>
      ) : null}
    </ModuleGuard>
  );
}
