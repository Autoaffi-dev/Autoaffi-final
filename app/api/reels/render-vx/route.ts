import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const workerUrl = process.env.REELS_RENDER_ENGINE_URL;
    const workerKey = process.env.REELS_RENDER_ENGINE_API_KEY;

    console.log("ENV DEBUG >>>", {
      workerUrl,
      workerKey,
    });

    if (!workerUrl) {
      return NextResponse.json(
        { error: "Missing REELS_RENDER_ENGINE_URL" },
        { status: 500 }
      );
    }

    if (!workerKey) {
      return NextResponse.json(
        { error: "Missing REELS_RENDER_ENGINE_API_KEY" },
        { status: 500 }
      );
    }

    // --------------------------
    // Hämta FormData
    // --------------------------
    const formData = await req.formData();

    // --------------------------
    // Metadata till VX 4.1
    // --------------------------
    const realism = formData.get("realism") ?? "60";
    const autoPacing = formData.get("autoPacing") ?? "true";
    const emotionBoost = formData.get("emotionBoost") ?? "true";
    const autoOverlays = formData.get("autoOverlays") ?? "true";

    const voiceMode = formData.get("voiceMode") ?? "auto";
    const voiceStyle = formData.get("voiceStyle") ?? "natural";

    const musicMode = formData.get("musicMode") ?? "auto";
    const musicStyle = formData.get("musicStyle") ?? "cinematic";

    const soundTransitions = formData.get("soundTransitions") ?? "true";
    const soundImpacts = formData.get("soundImpacts") ?? "true";
    const soundAmbience = formData.get("soundAmbience") ?? "true";

    const offerMeta = formData.get("offerMeta") ?? "{}";

    // --------------------------
    // Slå ihop metadata till ett JSON-block
    // --------------------------
    const metadata = {
      realism: Number(realism),
      autoPacing: autoPacing === "true",
      emotionBoost: emotionBoost === "true",
      autoOverlays: autoOverlays === "true",

      voice: { mode: voiceMode, style: voiceStyle },

      music: {
        mode: musicMode,
        style: musicStyle,
        transitions: soundTransitions === "true",
        impacts: soundImpacts === "true",
        ambience: soundAmbience === "true",
      },

      offerMeta: (() => {
        try {
          return JSON.parse(String(offerMeta));
        } catch {
          return {};
        }
      })(),
    };

    formData.set("vx41_meta", JSON.stringify(metadata));

    // ----------------------------------------------------
    // 🆕 NYA VX 4.1 / 4.2 FÄLT — måste skickas vidare
    // OBS: Vi tar INGET bort — vi lägger endast till dessa.
    // ----------------------------------------------------

    const beatMap = formData.get("beatMap") ?? "[]";
    const voiceTimeline = formData.get("voiceTimeline") ?? "[]";
    const exportTimeline = formData.get("exportTimeline") ?? "{}";
    const thumbnailIntelligence = formData.get("thumbnailIntelligence") ?? "{}";
    const hookIntelligence = formData.get("hookIntelligence") ?? "{}";
    const ctaIntelligence = formData.get("ctaIntelligence") ?? "{}";

    formData.set("beatMap", String(beatMap));
    formData.set("voiceTimeline", String(voiceTimeline));
    formData.set("exportTimeline", String(exportTimeline));
    formData.set("thumbnailIntelligence", String(thumbnailIntelligence));
    formData.set("hookIntelligence", String(hookIntelligence));
    formData.set("ctaIntelligence", String(ctaIntelligence));

    // --------------------------
    // SKICKA TILL WORKER
    // --------------------------
    console.log("FETCHING →", workerUrl);

    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "x-api-key": workerKey,
      },
      body: formData,
    });

    console.log("WORKER STATUS →", workerRes.status);

    const contentType = workerRes.headers.get("content-type") || "";

    if (!workerRes.ok) {
      if (contentType.includes("application/json")) {
        const errJson = await workerRes.json();
        console.log("WORKER JSON ERROR:", errJson);
        return NextResponse.json(
          { error: errJson.error || "Render engine failed" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Render engine returned non-JSON error" },
        { status: 500 }
      );
    }

    if (contentType.includes("application/json")) {
      const json = await workerRes.json();
      console.log("WORKER SUCCESS:", json);
      return NextResponse.json(json, { status: 200 });
    }

    return NextResponse.json(
      { error: "Unexpected worker response format" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("🔥 render-vx crashed:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}