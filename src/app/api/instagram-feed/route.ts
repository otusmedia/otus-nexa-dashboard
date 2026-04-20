import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_ID = process.env.META_INSTAGRAM_ID;

type MediaNode = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
};

export async function GET() {
  if (!ACCESS_TOKEN || !INSTAGRAM_ID?.trim()) {
    return NextResponse.json(
      { error: "Instagram API is not configured (META_ACCESS_TOKEN, META_INSTAGRAM_ID)." },
      { status: 503 },
    );
  }

  const id = INSTAGRAM_ID.trim();
  const fields = encodeURIComponent(
    "id,media_type,media_url,thumbnail_url,permalink,caption,like_count,comments_count",
  );
  const url = `https://graph.facebook.com/v19.0/${id}/media?fields=${fields}&limit=12&access_token=${ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = (await res.json()) as {
      data?: MediaNode[];
      error?: { message?: string };
    };

    if (data.error) {
      return NextResponse.json({ error: data.error.message ?? "Instagram media error" }, { status: 400 });
    }

    const nodes = Array.isArray(data.data) ? data.data : [];

    const posts = nodes.map((m) => {
      const isVideo = (m.media_type ?? "").toUpperCase() === "VIDEO" || (m.media_type ?? "").toUpperCase() === "REELS";
      const pick = (...urls: (string | undefined)[]) =>
        urls.find((u) => typeof u === "string" && u.trim().length > 0) ?? "";
      const imageUrl = (isVideo ? pick(m.thumbnail_url, m.media_url) : pick(m.media_url, m.thumbnail_url)).trim();
      return {
        id: String(m.id ?? ""),
        imageUrl,
        likes: typeof m.like_count === "number" ? m.like_count : Number(m.like_count) || 0,
        comments: typeof m.comments_count === "number" ? m.comments_count : Number(m.comments_count) || 0,
        caption: typeof m.caption === "string" ? m.caption.slice(0, 200) : "",
        permalink: typeof m.permalink === "string" ? m.permalink : "",
        isVideo,
      };
    });

    return NextResponse.json({ posts, source: "api" });
  } catch (error) {
    console.error("Instagram feed API error:", error);
    return NextResponse.json({ error: "Failed to fetch Instagram feed" }, { status: 500 });
  }
}
