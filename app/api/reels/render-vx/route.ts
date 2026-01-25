import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Säkerhetsmarginal för Vercel/Node – 300s = 5 min
export const maxDuration = 300;

type MediaType = "mixed" | "video" | "stills";

type MediaItem = {
  source?: string;
  url?: string;
  thumb?: string;
  duration?: number;
  [key: string]: any;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      console.error("[RENDER-VX ROUTE] Missing RENDER_WORKER_URL");
      return NextResponse.json(
        { ok: false, error: "Missing RENDER_WORKER_URL" },
        { status: 500 }
      );
    }

    const genre: string = body.genre || "motivation";
    const mediaType: MediaType = body.mediaType || "mixed";

    // 1) Försök använda mediaFiles från frontend (/api/reels/generate-result)
    let mediaFiles: MediaItem[] = Array.isArray(body.mediaFiles)
      ? body.mediaFiles
      : [];

    // 2) Om tomt → hämta direkt från /api/media/fetch (samma som generate)
    if (!mediaFiles.length) {
      const baseUrl =
        req.headers.get("origin") ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000";

      try {
        const mediaRes = await fetch(`${baseUrl}/api/media/fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: genre,
            type: mediaType,
          }),
        });

        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          mediaFiles =
            (mediaJson?.results?.slice?.(0, 12)) ||
            (mediaJson?.combined?.slice?.(0, 12)) ||
            [];
        } else {
          const txt = await mediaRes.text().catch(() => "");
          console.error(
            "[RENDER-VX ROUTE] media/fetch error",
            mediaRes.status,
            txt
          );
        }
      } catch (e) {
        console.error("[RENDER-VX ROUTE] media/fetch crash", e);
      }
    }

    // 3) Sista steg – hård fallback om allt annat brunnit upp
    if (!mediaFiles.length) {
      mediaFiles = [
        {
          source: "fallback",
          url: "https://public.autoaffi.com/fallback/fallback1.mp4",
          thumb: "https://public.autoaffi.com/fallback/thumb1.jpg",
          duration: body.duration || 8,
        },
      ];
    }

    // Payload → worker
    const payload = {
      ...body,
      mediaFiles,
    };

    // Se till att vi inte får dubbla "//"
    const workerEndpoint = `${workerUrl.replace(/\/+$/, "")}/render`;

    // Längre timeout mot workern (undici har annars headers-timeout)
    const signal =
      // Node 18+ har AbortSignal.timeout, men TS kan gnälla → any-cast
      (AbortSignal as any).timeout?.(280_000) ?? undefined;

    const res = await fetch(workerEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // @ts-ignore – vi vet att runtime är Node
      signal,
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error("[RENDER-VX ROUTE] fetch to worker crashed", err);
      throw err;
    });

    if (!res || !res.ok) {
      const status = res?.status ?? 500;
      const text = (await res?.text?.().catch(() => "")) ?? "";
      console.error("[RENDER-VX ROUTE] Worker error:", status, text);
      return NextResponse.json(
        {
          ok: false,
          error: "WORKER_ERROR",
          status,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    return NextResponse.json(json, { status: 200 });
  } catch (err: any) {
    console.error("[RENDER-VX ROUTE] Crash:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Render-VX route failed",
      },
      { status: 500 }
    );
  }
}