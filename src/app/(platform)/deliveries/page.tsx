"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { rowMatchesDataClient } from "@/lib/client-utils";
import { supabase } from "@/lib/supabase";
import {
  DeliveriesRecentExplorer,
  type DeliveriesExplorerItem,
} from "@/modules/deliveries/deliveries-recent-explorer";

const SAMPLE_COVERS: DeliveriesExplorerItem[] = [
  {
    id: "sample-1",
    title: "Run",
    mediaType: "image",
    aspect: "portrait",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e2612d772a61bb58d5e4f_works-grid_image01.jpg",
  },
  {
    id: "sample-2",
    title: "Space",
    mediaType: "image",
    aspect: "landscape",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e2633b2310fc391be2fab_works-grid_image02.jpg",
  },
  {
    id: "sample-3",
    title: "City drive",
    mediaType: "video",
    aspect: "landscape",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    id: "sample-4",
    title: "Botic",
    mediaType: "image",
    aspect: "square",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e263a61168467186ddf78_works-grid_image03.jpg",
  },
  {
    id: "sample-5",
    title: "Circle",
    mediaType: "image",
    aspect: "portrait",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e26418b044ed58ad0f0d7_works-grid_image04.jpg",
  },
  {
    id: "sample-6",
    title: "Flower loop",
    mediaType: "video",
    aspect: "portrait",
    mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "sample-7",
    title: "Space Suit",
    mediaType: "image",
    aspect: "landscape",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e264bedf7720885171c89_works-grid_image05.jpg",
  },
  {
    id: "sample-8",
    title: "Advanced",
    mediaType: "image",
    aspect: "square",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/6835db0140492ba6267bac14_works-grid_image06.jpg",
  },
  {
    id: "sample-9",
    title: "Joyride",
    mediaType: "video",
    aspect: "landscape",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
  {
    id: "sample-10",
    title: "Steeezy",
    mediaType: "image",
    aspect: "portrait",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e265ee03c4bec4a3bcc03_works-grid_image07.jpg",
  },
  {
    id: "sample-11",
    title: "Supreme",
    mediaType: "image",
    aspect: "square",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e26654345ecb581532a45_works-grid_image08.jpg",
  },
  {
    id: "sample-12",
    title: "Blazes",
    mediaType: "video",
    aspect: "portrait",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "sample-13",
    title: "PeopleFirst",
    mediaType: "image",
    aspect: "landscape",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e266c93a984ad8d3ee838_works-grid_image09.jpg",
  },
  {
    id: "sample-14",
    title: "DataSync",
    mediaType: "image",
    aspect: "portrait",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e2675eea3e44309311139_works-grid_image10.jpg",
  },
  {
    id: "sample-15",
    title: "Meltdown",
    mediaType: "video",
    aspect: "landscape",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  },
  {
    id: "sample-16",
    title: "FashionHub",
    mediaType: "image",
    aspect: "square",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e267d5e88d994a3a1e9c8_works-grid_image11.jpg",
  },
  {
    id: "sample-17",
    title: "FinTech",
    mediaType: "image",
    aspect: "landscape",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e2684c0d032a6cf7c7af1_works-grid_image12.jpg",
  },
  {
    id: "sample-18",
    title: "Summit",
    mediaType: "image",
    aspect: "portrait",
    mediaUrl:
      "https://cdn.prod.website-files.com/682b365fe602ffe9aded689a/682e268d0494fe0e0b0147b3_works-grid_image13.jpg",
  },
];

const SAMPLE_VIDEOS = SAMPLE_COVERS.filter((item) => item.mediaType === "video");

function isImageExt(type: string, name: string, url: string) {
  const hay = `${type} ${name} ${url}`.toLowerCase();
  return /\b(png|jpe?g|webp|gif|avif|heic|bmp|svg|image\/)\b/.test(hay);
}

function isVideoExt(type: string, name: string, url: string) {
  const hay = `${type} ${name} ${url}`.toLowerCase();
  return /\b(mp4|mov|webm|avi|mkv|video\/)\b/.test(hay);
}

function mergeRecent(
  uploaded: DeliveriesExplorerItem[],
  covers: DeliveriesExplorerItem[],
): DeliveriesExplorerItem[] {
  const seen = new Set<string>();
  const out: DeliveriesExplorerItem[] = [];
  for (const item of [...uploaded, ...covers]) {
    const key = item.mediaUrl || item.id;
    if (!item.mediaUrl || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 10) break;
  }
  if (out.length < 5) {
    for (const sample of SAMPLE_COVERS) {
      if (out.length >= 10) break;
      if (seen.has(sample.mediaUrl)) continue;
      seen.add(sample.mediaUrl);
      out.push(sample);
    }
  }
  // Keep a few short video thumbs in the mix so the hero always demos motion
  const videoCount = out.filter((i) => i.mediaType === "video").length;
  if (videoCount < 3) {
    for (const sample of SAMPLE_VIDEOS) {
      if (out.filter((i) => i.mediaType === "video").length >= 3) break;
      if (seen.has(sample.mediaUrl)) continue;
      const replaceAt = out.findIndex((i) => i.mediaType !== "video");
      if (replaceAt === -1) {
        if (out.length < 10) {
          seen.add(sample.mediaUrl);
          out.push(sample);
        }
        break;
      }
      seen.add(sample.mediaUrl);
      out[replaceAt] = sample;
    }
  }
  return out.slice(0, 10);
}

export default function DeliveriesPage() {
  const { dataClientSlug } = useAppContext();
  const { t: lt } = useLanguage();
  const [items, setItems] = useState<DeliveriesExplorerItem[]>(SAMPLE_COVERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        let filesQ = supabase
          .from("files")
          .select("id, name, type, url, created_at, client_slug")
          .order("created_at", { ascending: false })
          .limit(40);
        if (dataClientSlug) filesQ = filesQ.eq("client_slug", dataClientSlug);

        let tasksQ = supabase
          .from("tasks")
          .select("id, title, cover_image, created_at, client_slug")
          .not("cover_image", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);
        if (dataClientSlug) tasksQ = tasksQ.eq("client_slug", dataClientSlug);

        const [filesRes, tasksRes] = await Promise.all([filesQ, tasksQ]);

        const fileRows = ((filesRes.data as Array<Record<string, unknown>> | null) ?? []).filter(
          (row) =>
            rowMatchesDataClient(
              row.client_slug != null ? String(row.client_slug) : null,
              dataClientSlug,
            ),
        );
        const taskRows = ((tasksRes.data as Array<Record<string, unknown>> | null) ?? []).filter(
          (row) =>
            rowMatchesDataClient(
              row.client_slug != null ? String(row.client_slug) : null,
              dataClientSlug,
            ),
        );

        const fromFiles: DeliveriesExplorerItem[] = [];
        for (const row of fileRows) {
          const name = String(row.name ?? "");
          const type = String(row.type ?? "");
          const url = String(row.url ?? "").trim();
          if (!url) continue;
          if (isVideoExt(type, name, url)) {
            fromFiles.push({
              id: `file-${row.id}`,
              title: name || "Video",
              mediaUrl: url,
              mediaType: "video",
            });
          } else if (isImageExt(type, name, url)) {
            fromFiles.push({
              id: `file-${row.id}`,
              title: name || "Image",
              mediaUrl: url,
              mediaType: "image",
            });
          }
        }

        const fromTasks: DeliveriesExplorerItem[] = [];
        for (const row of taskRows) {
          const cover = String(row.cover_image ?? "").trim();
          if (!cover) continue;
          fromTasks.push({
            id: `task-${row.id}`,
            title: String(row.title ?? "Delivery"),
            mediaUrl: cover,
            mediaType: "image",
          });
        }

        if (!mounted) return;
        setItems(mergeRecent(fromFiles, fromTasks));
      } catch (err) {
        console.error("[deliveries] recent media load failed:", err);
        if (mounted) setItems(SAMPLE_COVERS);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [dataClientSlug]);

  const explorerItems = useMemo(() => items, [items]);

  return (
    <ModuleGuard module="deliveries">
      <div className="min-h-full bg-[#070707]">
        <DeliveriesRecentExplorer
          items={loading ? SAMPLE_COVERS : explorerItems}
          brandLabel={lt("Deliveries")}
          headline={lt("Recent deliveries that stand out")}
          viewLabel={lt("view")}
        />

        {/* Traditional Drive-style explorer comes next */}
        <section
          id="deliveries-files"
          className="border-t border-white/[0.06] bg-[#0a0a0a] px-6 py-20 lg:px-8"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-white/35">
              {lt("File library")}
            </p>
            <h2 className="mt-3 text-xl font-medium tracking-tight text-white/80 sm:text-2xl">
              {lt("Full file explorer coming next")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/40">
              {lt(
                "Same Drive-style browser you already know from Files — placed under this hero.",
              )}
            </p>
          </div>
        </section>
      </div>
    </ModuleGuard>
  );
}
