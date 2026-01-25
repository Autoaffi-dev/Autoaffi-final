"use client";

import React, { useState } from "react";

interface RenderVXProps {
  // ⬇️ UPPDATERAD: startRenderVX ska returnera ok + videoUrl
  startRenderVX: (fd: FormData) => Promise<{
    ok: boolean;
    videoUrl?: string | null;
    error?: string;
  }>;
  mode: "auto" | "guided" | "manual";
  videoLength: number;
  affiliateLink?: string | null;
}

export default function RenderVX({
  startRenderVX,
  mode,
  videoLength,
  affiliateLink,
}: RenderVXProps) {
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ---- NEW: VOICE + MUSIC + REALISM ----
  const [voiceStyle, setVoiceStyle] = useState("Natural");
  const [musicMode, setMusicMode] = useState("Auto");
  const [realism, setRealism] = useState(5);

  const [useTransitions, setUseTransitions] = useState(true);
  const [useImpacts, setUseImpacts] = useState(true);
  const [useAmbience, setUseAmbience] = useState(true);

  const stepsList = [
    "Building storyboard…",
    "Generating voice & pacing…",
    "Creating cinematic transitions…",
    "Rendering Ultra HD video…",
    "Preparing download link…",
  ];

  // =========================================================
  // HANDLE RENDER (FULL API SYNC + DIN UI OFÖRÄNDRAD)
  // =========================================================
  const handleRender = async () => {
    if (isRendering) return;

    setIsRendering(true);
    setVideoReady(false);
    setDownloadUrl(null);
    setProgress(0);
    setStep(0);

    // Progress simulation (visuellt godis)
    const interval = setInterval(() => {
      setProgress((p) => (p >= 98 ? 98 : p + 2));
    }, 180);

    const stepInterval = setInterval(() => {
      setStep((s) => (s >= stepsList.length - 1 ? s : s + 1));
    }, 1500);

    try {
      // ------------------------------
      // BUILD FORMDATA FOR WORKER
      // ------------------------------
      const fd = new FormData();

      fd.append("realism", String(realism));
      fd.append("voiceStyle", voiceStyle);
      fd.append("musicMode", musicMode);

      fd.append("musicTransitions", String(useTransitions));
      fd.append("musicImpacts", String(useImpacts));
      fd.append("musicAmbience", String(useAmbience));

      // Page.tsx kommer automatiskt lägga till:
      // script
      // beatMap
      // voiceTimeline
      // exportTimeline
      // media uploads
      // videoLength
      // mediaType
      // (du är redan helt synkad)

      // 🔥 CALL THE WORKER VIA startRenderVX
      const result = await startRenderVX(fd);

      if (!result?.ok || !result.videoUrl) {
        console.error("[RenderVX] startRenderVX failed:", result?.error);
        throw new Error(result?.error || "Render worker did not return videoUrl");
      }

      // ✅ Worker returnerade en giltig videoUrl
      setProgress(100);
      setVideoReady(true);
      setDownloadUrl(result.videoUrl);
    } catch (err) {
      console.error("[RenderVX] handleRender error:", err);
    } finally {
      clearInterval(interval);
      clearInterval(stepInterval);
      setIsRendering(false);
    }
  };

  // ---- PILL BUTTON STYLE ----
  const pill = (active: boolean) =>
    `px-4 py-2 rounded-xl border transition ${
      active
        ? "bg-emerald-600 text-white border-emerald-500"
        : "bg-black/30 text-gray-300 border-gray-600 hover:bg-black/50"
    }`;

  return (
    <div className="mt-16 p-10 rounded-2xl bg-black/20 border border-purple-400/20 shadow-xl space-y-10">
      {/* HEADER */}
      <h2 className="text-3xl font-bold text-emerald-300 text-center">
        Autoaffi VX — Ultra HD Render Engine
      </h2>
      <p className="text-center text-gray-300 text-sm">
        AI-optimized cinematic rendering powered by VX-Render-Pipeline-2026.
        <br />
        Mode: {mode} • Length: {videoLength}s
      </p>

      {/* ===================================================== */}
      {/* VOICE STYLE */}
      {/* ===================================================== */}
      <div>
        <p className="text-gray-300 mb-2">Voice Style</p>
        <div className="flex flex-wrap gap-3">
          {[
            "Natural",
            "Deep",
            "Energetic",
            "Calm",
            "Female Clean",
            "Male Cinematic",
          ].map((v) => (
            <button
              key={v}
              onClick={() => setVoiceStyle(v)}
              className={pill(voiceStyle === v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================== */}
      {/* REALISM */}
      {/* ===================================================== */}
      <div>
        <p className="text-gray-300 mb-2">Visual Realism</p>

        <input
          type="range"
          min={1}
          max={10}
          value={realism}
          onChange={(e) => setRealism(Number(e.target.value))}
          className="w-full"
        />

        <p className="text-gray-400 text-sm mt-1">
          Current realism: {realism}/10
        </p>

        <p className="text-gray-500 text-xs mt-1">
          Higher realism increases cinematic depth, shadows, lighting precision
          and overall clarity.
        </p>
      </div>

      {/* ===================================================== */}
      {/* MUSIC MODE */}
      {/* ===================================================== */}
      <div>
        <p className="text-gray-300 mb-2">Music Mode</p>

        <div className="flex flex-wrap gap-3">
          {["Auto", "Cinematic", "Fast", "Emotional", "Minimal", "Silent"].map(
            (m) => (
              <button
                key={m}
                onClick={() => setMusicMode(m)}
                className={pill(musicMode === m)}
              >
                {m}
              </button>
            )
          )}
        </div>

        {/* CHECKBOX EFFECTS */}
        <div className="flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useTransitions}
              onChange={(e) => setUseTransitions(e.target.checked)}
            />
            Transitions
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useImpacts}
              onChange={(e) => setUseImpacts(e.target.checked)}
            />
            Impacts
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useAmbience}
              onChange={(e) => setUseAmbience(e.target.checked)}
            />
            Ambience
          </label>
        </div>

        {/* CLICK EXPLANATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 rounded-xl bg-black/30 border border-gray-700">
            <p className="text-emerald-300 mb-1 font-semibold">Transitions</p>
            <p className="text-gray-400 text-xs">
              Smooth cinematic cuts & pacing transitions between scenes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-gray-700">
            <p className="text-blue-300 mb-1 font-semibold">Impacts</p>
            <p className="text-gray-400 text-xs">
              Strong audio/visual hit markers synced with major script beats.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-gray-700">
            <p className="text-purple-300 mb-1 font-semibold">Ambience</p>
            <p className="text-gray-400 text-xs">
              Subtle ambient layers that add realism, depth and mood.
            </p>
          </div>
        </div>
      </div>

      {/* ===================================================== */}
      {/* RENDER BUTTON */}
      {/* ===================================================== */}
      {!videoReady && (
        <button
          onClick={handleRender}
          disabled={isRendering}
          className="w-full py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 transition"
        >
          {isRendering ? "Rendering…" : "🎥 Create Video (Ultra HD)"}
        </button>
      )}

      {/* ===================================================== */}
      {/* PROGRESS */}
      {/* ===================================================== */}
      {isRendering && !videoReady && (
        <div className="space-y-4 pt-4">
          <div className="w-full h-3 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-blue-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-gray-300">{stepsList[step]}</p>
        </div>
      )}

      {/* ===================================================== */}
      {/* VIDEO READY */}
      {/* ===================================================== */}
      {videoReady && (
        <div className="space-y-6 pt-6">
          <div className="text-center text-emerald-300 font-semibold text-lg">
            ✓ Video Ready — Your Ultra HD reel is complete!
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="block text-center py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              ⬇️ Download Video
            </a>
          )}

          {affiliateLink && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-900/30 border border-emerald-500/20 text-center">
              <p className="text-emerald-300 font-medium">Affiliate Link Used</p>
              <code className="text-emerald-200">{affiliateLink}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}