"use client";

import { cn } from "@/lib/utils";
import type { PortfolioMediaType } from "@/lib/portfolio";

export function PortfolioMediaFill({
  type,
  url,
  className,
  loopVideo,
}: {
  type: PortfolioMediaType | null;
  url: string | null;
  className?: string;
  loopVideo?: boolean;
}) {
  if (!url) {
    return <div className={cn("bg-[#1a1a1a]", className)} />;
  }
  if (type === "video" && !url.includes("youtube") && !url.includes("vimeo")) {
    return (
      <video
        src={url}
        className={cn("h-full w-full object-cover", className)}
        autoPlay={loopVideo}
        muted
        loop={loopVideo}
        playsInline
      />
    );
  }
  if (type === "video" && (url.includes("youtube") || url.includes("vimeo"))) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-black text-sm text-white/50", className)}>
        Video URL
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn("h-full w-full object-cover", className)} />
  );
}
