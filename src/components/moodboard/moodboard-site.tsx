"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type {
  MoodboardItemContent,
  MoodboardLocal,
  MoodboardPageContent,
  MoodboardSiteData,
} from "@/lib/moodboard";
import { cn } from "@/lib/utils";

type MoodboardSiteProps = {
  mode: "edit" | "view";
  data: MoodboardSiteData;
  publicUrl?: string | null;
  publishing?: boolean;
  publishSuccessLabel?: string;
  viewLiveLabel?: string;
  onChangePage?: (patch: Partial<MoodboardPageContent> & { name?: string }) => void | Promise<void>;
  onUpload?: (folder: "logo" | "items", file: File) => Promise<string>;
  onAddItem?: (input: {
    mediaUrl: string;
    width?: number | null;
    height?: number | null;
  }) => void | Promise<void>;
  onDeleteItem?: (itemId: string) => void | Promise<void>;
  onPublish?: () => void | Promise<void>;
  readImageSize?: (file: File) => Promise<{ width: number; height: number } | null>;
};

function EditableText({
  mode,
  value,
  onSave,
  className,
  placeholder,
  multiline,
  as: Tag = "span",
}: {
  mode: "edit" | "view";
  value: string;
  onSave?: (next: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  as?: "span" | "p" | "h2";
}) {
  if (mode !== "edit" || !onSave) {
    if (!value.trim()) return placeholder ? <Tag className={className}>{placeholder}</Tag> : null;
    return <Tag className={className}>{value}</Tag>;
  }

  if (multiline) {
    return (
      <textarea
        value={value}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onSave(e.target.value)}
        className={cn(
          "w-full resize-none bg-transparent text-center outline-none placeholder:text-black/25",
          className,
        )}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onSave(e.target.value)}
      className={cn(
        "w-full bg-transparent text-center outline-none placeholder:text-black/25",
        className,
      )}
    />
  );
}

function aspectStyle(item: MoodboardItemContent): CSSProperties | undefined {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { aspectRatio: `${item.width} / ${item.height}` };
  }
  return undefined;
}

export function MoodboardSite({
  mode,
  data,
  publicUrl,
  publishing,
  publishSuccessLabel = "Published successfully",
  viewLiveLabel = "Open live page",
  onChangePage,
  onUpload,
  onAddItem,
  onDeleteItem,
  onPublish,
  readImageSize,
}: MoodboardSiteProps) {
  const { t: lt } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [publishToast, setPublishToast] = useState(false);
  const dragDepth = useRef(0);

  const { page, items } = data;
  const brand = page.title.trim() || data.name;
  const collage = items.slice(0, 4);
  const leftCluster = collage.slice(0, 2);
  const rightCluster = collage.slice(2, 4);
  const locais = page.locais;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!publishToast) return;
    const t = window.setTimeout(() => setPublishToast(false), 8000);
    return () => window.clearTimeout(t);
  }, [publishToast]);

  const scrollToBoard = () => {
    const board = document.getElementById("board");
    if (!board) return;
    const target = board.getBoundingClientRect().top + window.scrollY;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, target);
      return;
    }
    const start = window.scrollY;
    const dist = target - start;
    const dur = 700;
    const t0 = performance.now();
    const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, start + dist * easeOutQuart(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (mode !== "edit" || !onUpload || !onAddItem) return;
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      setBusy(true);
      setError("");
      try {
        for (const file of list) {
          const size = readImageSize ? await readImageSize(file) : null;
          const url = await onUpload("items", file);
          await onAddItem({
            mediaUrl: url,
            width: size?.width ?? null,
            height: size?.height ?? null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : lt("Could not save."));
      } finally {
        setBusy(false);
      }
    },
    [mode, onUpload, onAddItem, readImageSize, lt],
  );

  const onWindowDragEnter = useCallback(
    (e: DragEvent) => {
      if (mode !== "edit") return;
      e.preventDefault();
      dragDepth.current += 1;
      if (e.dataTransfer?.types?.includes("Files")) setDragActive(true);
    },
    [mode],
  );

  const onWindowDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }, []);

  const onWindowDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      if (mode !== "edit") return;
      if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
    },
    [mode, addFiles],
  );

  const handleLogoPick = async (file: File | null) => {
    if (!file || !onUpload || !onChangePage) return;
    setBusy(true);
    setError("");
    try {
      const url = await onUpload("logo", file);
      await onChangePage({ logoUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : lt("Could not save."));
    } finally {
      setBusy(false);
    }
  };

  const handleUrlSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const mediaUrl = urlValue.trim();
    if (!mediaUrl || !onAddItem) return;
    setBusy(true);
    setError("");
    try {
      await onAddItem({ mediaUrl });
      setUrlValue("");
      setUrlOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : lt("Could not save."));
    } finally {
      setBusy(false);
    }
  };

  const updateLocal = (id: string, patch: Partial<MoodboardLocal>) => {
    const next = locais.map((l) => (l.id === id ? { ...l, ...patch } : l));
    void onChangePage?.({ locais: next });
  };

  const addLocal = () => {
    const next: MoodboardLocal[] = [
      ...locais,
      {
        id: crypto.randomUUID(),
        time: "00:00 – 00:00",
        name: "Novo local",
        address: "",
        meta: "",
      },
    ];
    void onChangePage?.({ locais: next });
  };

  const removeLocal = (id: string) => {
    void onChangePage?.({ locais: locais.filter((l) => l.id !== id) });
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    try {
      await onPublish();
      setPublishToast(true);
    } catch {
      /* parent sets error */
    }
  };

  const countLabel =
    items.length === 1 ? "1 imagem" : `${items.length} imagens`;

  return (
    <div
      className="moodboard-ref relative min-h-screen overflow-x-hidden"
      style={{
        background: "oklch(97.5% 0 0)",
        color: "oklch(24% 0 0)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
      onDragEnter={onWindowDragEnter}
      onDragLeave={onWindowDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onWindowDrop}
    >
      <style>{`
        @keyframes moodboard-aurora-1 {
          0% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(20%, -20%) scale(1.2); }
          50% { transform: translate(-20%, 20%) scale(0.8); }
          75% { transform: translate(10%, -10%) scale(1.1); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
        @keyframes moodboard-aurora-2 {
          0% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(-20%, 20%) scale(1.1); }
          50% { transform: translate(20%, -20%) scale(0.9); }
          75% { transform: translate(-10%, 10%) scale(1.2); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .moodboard-aurora span { animation: none !important; }
        }
      `}</style>

      {/* Floating dark nav — reference style */}
      <nav
        className="fixed left-1/2 top-4 z-[5] flex -translate-x-1/2 items-center gap-5 whitespace-nowrap rounded-[14px] px-2.5 py-2.5 pl-5 shadow-[0_4px_24px_oklch(0%_0_0_/_0.12)]"
        style={{ background: "oklch(21% 0 0)", color: "oklch(97% 0 0)" }}
      >
        {mode === "edit" ? (
          <input
            value={page.title}
            onChange={(e) => void onChangePage?.({ title: e.target.value, name: e.target.value })}
            placeholder="Brand"
            className="max-w-[10rem] bg-transparent text-sm font-semibold tracking-[0.01em] outline-none placeholder:text-white/35 sm:max-w-[14rem]"
          />
        ) : (
          <span className="text-sm font-semibold tracking-[0.01em]">{brand}</span>
        )}
        <span className="text-[12.5px] tabular-nums text-white/55">{countLabel}</span>
        {mode === "edit" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-[9px] px-3.5 py-2 text-[13px] font-medium transition"
              style={{ background: "oklch(98% 0 0)", color: "oklch(21% 0 0)" }}
            >
              {lt("Add images")}
            </button>
            <button
              type="button"
              onClick={() => setUrlOpen(true)}
              className="hidden rounded-[9px] px-3 py-2 text-[12px] text-white/70 hover:text-white sm:inline"
            >
              URL
            </button>
            <button
              type="button"
              disabled={publishing || busy}
              onClick={() => void handlePublish()}
              className="rounded-[9px] bg-[#ff4500] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {publishing ? "…" : "Publish"}
            </button>
          </>
        ) : null}
      </nav>

      {error ? (
        <p className="fixed left-0 right-0 top-[72px] z-20 bg-[#2b1111] px-4 py-1.5 text-center text-xs text-[#fca5a5]">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void handleLogoPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {/* Hero */}
      <section
        id="hero"
        className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-24 text-center"
      >
        <div className="moodboard-aurora pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <span
            className="absolute rounded-full"
            style={{
              top: "-12%",
              left: "22%",
              width: "clamp(280px, 40vw, 520px)",
              height: "clamp(280px, 40vw, 520px)",
              background: "oklch(72% 0.09 85 / 0.28)",
              filter: "blur(64px)",
              animation: "moodboard-aurora-1 20s ease-in-out infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              bottom: "-12%",
              right: "22%",
              width: "clamp(280px, 40vw, 520px)",
              height: "clamp(280px, 40vw, 520px)",
              background: "oklch(70% 0.10 70 / 0.26)",
              filter: "blur(64px)",
              animation: "moodboard-aurora-2 20s ease-in-out infinite",
            }}
          />
        </div>

        <button
          type="button"
          disabled={mode !== "edit"}
          onClick={() => mode === "edit" && logoInputRef.current?.click()}
          className={cn(
            "mx-auto block",
            mode === "edit" && "cursor-pointer rounded-md outline-offset-4 hover:opacity-80",
          )}
          aria-label={mode === "edit" ? "Replace logo" : "Logo"}
        >
          {page.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.logoUrl}
              alt=""
              className="mx-auto block h-[clamp(72px,14vw,128px)] w-auto object-contain"
              style={{ filter: "brightness(0)" }}
            />
          ) : (
            <span
              className="inline-flex h-[clamp(72px,14vw,128px)] min-w-[120px] items-center justify-center rounded-md border border-dashed border-black/20 px-4 text-xs uppercase tracking-[0.14em] text-black/35"
            >
              {mode === "edit" ? "Logo" : brand}
            </span>
          )}
        </button>

        <h1 className="sr-only">{brand}</h1>

        <div
          className="mt-[22px] w-full max-w-xl [&_input]:text-[clamp(1.25rem,2.6vw,1.75rem)] [&_p]:text-[clamp(1.25rem,2.6vw,1.75rem)]"
          style={{ color: "oklch(52% 0 0)" }}
        >
          <EditableText
            mode={mode}
            value={page.subtitle}
            placeholder={lt("MoodBoard & Visual Direction")}
            onSave={(subtitle) => void onChangePage?.({ subtitle })}
            as="p"
          />
        </div>

        <div className="mt-3.5 w-full max-w-md text-[15px] tabular-nums" style={{ color: "oklch(52% 0 0)" }}>
          <EditableText
            mode={mode}
            value={page.dateLabel}
            placeholder={mode === "edit" ? "Data" : undefined}
            onSave={(dateLabel) => void onChangePage?.({ dateLabel })}
            as="p"
          />
        </div>

        <div className="mt-[clamp(48px,9vh,110px)] flex w-full flex-wrap items-center justify-center gap-x-[clamp(28px,5vw,64px)] gap-y-11 px-2">
          <div className="relative h-[clamp(210px,26vw,310px)] w-[clamp(168px,20vw,248px)] shrink-0">
            {leftCluster[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leftCluster[0].mediaUrl}
                alt=""
                className="absolute bottom-0 left-0 z-[1] h-[78%] w-[72%] rounded-[10px] object-cover shadow-[0_10px_32px_oklch(0%_0_0_/_0.14)]"
                style={{ rotate: "-3deg", background: "oklch(93% 0 0)" }}
              />
            ) : null}
            {leftCluster[1] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={leftCluster[1].mediaUrl}
                alt=""
                className="absolute right-0 top-0 z-[2] h-[68%] w-[58%] rounded-[10px] object-cover shadow-[0_10px_32px_oklch(0%_0_0_/_0.14)]"
                style={{ rotate: "4deg", background: "oklch(93% 0 0)" }}
              />
            ) : null}
          </div>

          <button
            type="button"
            id="ver-fotos"
            onClick={scrollToBoard}
            className="order-first w-full max-w-[220px] shrink-0 rounded-[10px] px-[26px] py-[13px] text-[15px] font-medium transition hover:-translate-y-px sm:order-none sm:w-auto sm:max-w-none"
            style={{ background: "oklch(21% 0 0)", color: "oklch(98% 0 0)" }}
          >
            {lt("View photos")}
          </button>

          <div className="relative h-[clamp(210px,26vw,310px)] w-[clamp(168px,20vw,248px)] shrink-0">
            {rightCluster[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rightCluster[0].mediaUrl}
                alt=""
                className="absolute right-0 top-[4%] z-[1] h-[78%] w-[72%] rounded-[10px] object-cover shadow-[0_10px_32px_oklch(0%_0_0_/_0.14)]"
                style={{ rotate: "3deg", background: "oklch(93% 0 0)" }}
              />
            ) : null}
            {rightCluster[1] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rightCluster[1].mediaUrl}
                alt=""
                className="absolute bottom-0 left-0 z-[2] h-[68%] w-[58%] rounded-[10px] object-cover shadow-[0_10px_32px_oklch(0%_0_0_/_0.14)]"
                style={{ rotate: "-4deg", background: "oklch(93% 0 0)" }}
              />
            ) : null}
          </div>
        </div>
      </section>

      {/* Locais */}
      <section id="locais" className="mx-auto max-w-[720px] px-6 pb-[72px] pt-12" aria-labelledby="locais-title">
        <h2
          id="locais-title"
          className="m-0 text-center text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em]"
        >
          Locais
        </h2>
        <p className="mb-10 mt-2 text-center text-[15px]" style={{ color: "oklch(52% 0 0)" }}>
          Horários da captura
        </p>
        <ul className="m-0 list-none border-t p-0" style={{ borderColor: "oklch(88% 0 0)" }}>
          {locais.map((local) => (
            <li
              key={local.id}
              className="grid grid-cols-1 gap-1.5 border-b py-[22px] sm:grid-cols-[140px_1fr_auto] sm:items-baseline sm:gap-x-7"
              style={{ borderColor: "oklch(88% 0 0)" }}
            >
              {mode === "edit" ? (
                <>
                  <input
                    value={local.time}
                    onChange={(e) => updateLocal(local.id, { time: e.target.value })}
                    className="bg-transparent text-sm font-semibold tabular-nums outline-none"
                    placeholder="Horário"
                  />
                  <div>
                    <input
                      value={local.name}
                      onChange={(e) => updateLocal(local.id, { name: e.target.value })}
                      className="w-full bg-transparent text-base font-semibold outline-none"
                      placeholder="Local"
                    />
                    <input
                      value={local.address}
                      onChange={(e) => updateLocal(local.id, { address: e.target.value })}
                      className="mt-1 w-full bg-transparent text-sm outline-none"
                      style={{ color: "oklch(52% 0 0)" }}
                      placeholder="Endereço (opcional)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={local.meta}
                      onChange={(e) => updateLocal(local.id, { meta: e.target.value })}
                      className="bg-transparent text-[13px] outline-none"
                      style={{ color: "oklch(52% 0 0)" }}
                      placeholder="Meta"
                    />
                    <button
                      type="button"
                      onClick={() => removeLocal(local.id)}
                      className="rounded p-1 text-black/35 hover:bg-black/5 hover:text-black/70"
                      aria-label="Remover local"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold tabular-nums">{local.time}</span>
                  <div>
                    <p className="m-0 text-base font-semibold">{local.name}</p>
                    {local.address ? (
                      <p className="mt-1 text-sm leading-snug" style={{ color: "oklch(52% 0 0)" }}>
                        {local.address}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[13px]" style={{ color: "oklch(52% 0 0)" }}>
                    {local.meta}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={addLocal}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-black/75"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar local
          </button>
        ) : null}
      </section>

      {/* Mural */}
      <main
        id="board"
        className="mx-auto max-w-[1720px] columns-2 gap-[10px] px-4 pb-12 pt-6 sm:px-6 md:columns-3 lg:columns-4 xl:columns-5"
      >
        {items.map((item) => (
          <figure key={item.id} className="group relative mb-[10px] break-inside-avoid">
            <button
              type="button"
              className="block w-full cursor-zoom-in overflow-hidden rounded-[3px]"
              onClick={() => setLightbox(item.mediaUrl)}
              aria-label="Open image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.mediaUrl}
                alt=""
                decoding="async"
                loading="lazy"
                className="block h-auto w-full rounded-[3px]"
                style={{ ...aspectStyle(item), background: "oklch(93% 0 0)" }}
              />
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => void onDeleteItem?.(item.id)}
                className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </figure>
        ))}
      </main>

      {dragActive && mode === "edit" ? (
        <div
          className="pointer-events-none fixed inset-0 z-10 grid place-items-center border-2 border-dashed text-[15px] font-medium"
          style={{
            background: "oklch(97.5% 0 0 / 0.92)",
            borderColor: "oklch(52% 0 0)",
            color: "oklch(24% 0 0)",
          }}
        >
          {lt("Drop images to add to the mural")}
        </div>
      ) : null}

      {urlOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={(e) => void handleUrlSubmit(e)}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">{lt("Add image URL")}</h3>
              <button type="button" onClick={() => setUrlOpen(false)} className="p-1 text-black/40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://"
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setUrlOpen(false)} className="px-3 py-1.5 text-xs text-black/50">
                {lt("Cancel")}
              </button>
              <button
                type="submit"
                disabled={busy || !urlValue.trim()}
                className="rounded-md bg-[oklch(21%_0_0)] px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {lt("Save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[20] flex cursor-zoom-out items-center justify-center px-3"
          style={{ background: "oklch(15% 0 0 / 0.88)" }}
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[94vh] max-w-[94vw] rounded-[3px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {publishToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full px-[18px] py-2.5 text-[13px] text-white shadow-lg"
          style={{ background: "oklch(24% 0 0)" }}
        >
          <p>{publishSuccessLabel}</p>
          {publicUrl ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[#ff9a70] underline">
              {viewLiveLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
