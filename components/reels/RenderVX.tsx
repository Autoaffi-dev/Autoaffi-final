"use client";

import React, { useMemo, useRef, useState } from "react";

interface RenderVXStartResult {
  ok: boolean;
  videoUrl?: string | null;
  jobId?: string | null;
  statusUrl?: string | null;
  error?: string;
}

interface RenderVXStatusResult {
  ok: boolean;
  status?: "queued" | "processing" | "completed" | "failed" | "error";
  progress?: number;
  videoUrl?: string | null;
  error?: string | null;
  message?: string | null;
}

interface RenderVXProps {
  startRenderVX: (fd: FormData) => Promise<RenderVXStartResult>;
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
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const shouldStopPollingRef = useRef(false);

  // ---- VOICE + MUSIC + REALISM ----
  const [voiceStyle, setVoiceStyle] = useState("Natural");
  const [musicMode, setMusicMode] = useState("Auto");
  const [realism, setRealism] = useState(5);

  const [useTransitions, setUseTransitions] = useState(true);
  const [useImpacts, setUseImpacts] = useState(true);
  const [useAmbience, setUseAmbience] = useState(true);

  // -------------------------------------------------
  // SMART DERIVED RENDER SIGNALS
  // -------------------------------------------------

  const realismLabel = useMemo(() => {
    if (realism <= 3) return "Clean";
    if (realism <= 6) return "Balanced";
    if (realism <= 8) return "Cinematic";
    return "Ultra Real";
  }, [realism]);

  const pacingProfile = useMemo(() => {
    if (musicMode === "Fast") return "fast";
    if (musicMode === "Minimal" || musicMode === "Silent") return "steady";
    if (musicMode === "Emotional") return "emotional";
    return "cinematic";
  }, [musicMode]);

  const storyProfile = useMemo(() => {
    if (mode === "manual") return "offer_focus";
    if (musicMode === "Emotional") return "problem_solution_payoff";
    if (musicMode === "Fast") return "hook_proof_cta";
    if (realism >= 8) return "cinematic_authority";
    return "business_freedom";
  }, [mode, musicMode, realism]);

  const clipStrategy = useMemo(() => {
    if (musicMode === "Fast") return "high_energy";
    if (musicMode === "Minimal") return "clean_premium";
    if (musicMode === "Emotional") return "story_driven";
    if (realism >= 8) return "cinematic_realism";
    return "balanced_business";
  }, [musicMode, realism]);

  const audioProfile = useMemo(() => {
    if (musicMode === "Silent") return "voice_only";
    if (useImpacts && useAmbience && useTransitions) return "full_fx";
    if (useImpacts || useAmbience || useTransitions) return "hybrid_fx";
    return "clean_voice_bed";
  }, [musicMode, useImpacts, useAmbience, useTransitions]);

  const stepMessages = useMemo(() => {
    const base = [
      "Building storyboard…",
      "Generating voice & pacing…",
      "Selecting the best clips…",
      "Rendering cinematic scenes…",
      "Preparing download link…",
    ];

    if (musicMode === "Silent") {
      return [
        "Building clean visual storyboard…",
        "Generating voice & pacing…",
        "Selecting premium clips…",
        "Rendering voice-first video…",
        "Preparing download link…",
      ];
    }

    if (musicMode === "Fast") {
      return [
        "Building fast-paced storyboard…",
        "Generating voice & timing…",
        "Syncing clips with impacts…",
        "Rendering high-energy video…",
        "Preparing download link…",
      ];
    }

    if (musicMode === "Emotional") {
      return [
        "Building emotional story arc…",
        "Generating voice & pacing…",
        "Selecting mood-driven clips…",
        "Rendering cinematic scenes…",
        "Preparing download link…",
      ];
    }

    return base;
  }, [musicMode]);

  const buildFileName = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `autoaffi-reel-${videoLength}s-${ts}.mp4`;
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

  const triggerAnchorDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const normalizeStatusUrl = (jobId: string, statusUrl?: string | null) => {
    if (statusUrl && statusUrl.trim()) return statusUrl.trim();
    return `/api/reels/render-vx/status?jobId=${encodeURIComponent(jobId)}`;
  };

  const pollRenderJob = async (params: {
    jobId: string;
    statusUrl?: string | null;
  }): Promise<string> => {
    const { jobId, statusUrl } = params;

    const url = normalizeStatusUrl(jobId, statusUrl);

    const startedAt = Date.now();
    const maxWaitMs = 8 * 60 * 1000;
    const pollDelayMs = 2500;

    let lastKnownProgress = 8;

    while (!shouldStopPollingRef.current) {
      if (Date.now() - startedAt > maxWaitMs) {
        throw new Error("Render timed out. Please try again.");
      }

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Render status failed with status ${res.status}`);
      }

      const statusJson = (await res.json()) as RenderVXStatusResult;

      if (!statusJson?.ok) {
        throw new Error(
          statusJson?.error ||
            statusJson?.message ||
            "Render status returned an error"
        );
      }

      const nextProgress =
        typeof statusJson.progress === "number" &&
        Number.isFinite(statusJson.progress)
          ? Math.max(0, Math.min(100, statusJson.progress))
          : null;

      if (nextProgress !== null) {
        lastKnownProgress = Math.max(lastKnownProgress, nextProgress);
        setProgress(Math.min(98, lastKnownProgress));
      } else {
        setProgress((p) => {
          const next = Math.max(p, Math.min(98, p + 2));
          lastKnownProgress = next;
          return next;
        });
      }

      if (statusJson.status === "completed" && statusJson.videoUrl) {
        return statusJson.videoUrl;
      }

      if (statusJson.videoUrl) {
        return statusJson.videoUrl;
      }

      if (
        statusJson.status === "failed" ||
        statusJson.status === "error"
      ) {
        throw new Error(
          statusJson.error ||
            statusJson.message ||
            "Render failed. Please try again."
        );
      }

      await sleep(pollDelayMs);
    }

    throw new Error("Render was cancelled.");
  };

  const handleDownloadMp4 = async () => {
    if (!downloadUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);

    const fileName = buildFileName();

    try {
      const res = await fetch(downloadUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      triggerAnchorDownload(objectUrl, fileName);

      setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1500);
    } catch (err) {
      console.error("[RenderVX] handleDownloadMp4 failed:", err);

      try {
        triggerAnchorDownload(downloadUrl, fileName);
      } catch {
        setDownloadError("Could not download the MP4 automatically.");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenVideo = () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  // =========================================================
  // HANDLE RENDER
  // =========================================================
  const handleRender = async () => {
    if (isRendering) return;

    shouldStopPollingRef.current = false;

    setIsRendering(true);
    setVideoReady(false);
    setDownloadUrl(null);
    setDownloadError(null);
    setCurrentJobId(null);
    setProgress(0);
    setStep(0);

    const interval = setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + 1));
    }, 450);

    const stepInterval = setInterval(() => {
      setStep((s) => (s >= stepMessages.length - 1 ? s : s + 1));
    }, 2500);

    try {
      const fd = new FormData();

      // existing fields
      fd.append("realism", String(realism));
      fd.append("voiceStyle", voiceStyle);
      fd.append("musicMode", musicMode);

      fd.append("musicTransitions", String(useTransitions));
      fd.append("musicImpacts", String(useImpacts));
      fd.append("musicAmbience", String(useAmbience));

      // new smart sync fields
      fd.append("mode", mode);
      fd.append("videoLength", String(videoLength));
      fd.append("affiliateLink", affiliateLink || "");

      fd.append("realismLabel", realismLabel);
      fd.append("pacingProfile", pacingProfile);
      fd.append("storyProfile", storyProfile);
      fd.append("clipStrategy", clipStrategy);
      fd.append("audioProfile", audioProfile);

      fd.append(
        "renderIntent",
        JSON.stringify({
          mode,
          videoLength,
          voiceStyle,
          musicMode,
          realism,
          realismLabel,
          pacingProfile,
          storyProfile,
          clipStrategy,
          audioProfile,
          useTransitions,
          useImpacts,
          useAmbience,
          affiliateLink: affiliateLink || null,
        })
      );

      const result = await startRenderVX(fd);

      if (!result?.ok) {
        console.error("[RenderVX] startRenderVX failed:", result?.error);
        throw new Error(result?.error || "Render could not start");
      }

      // -------------------------------------------------
      // MODE 1: OLD DIRECT FLOW
      // If backend still returns videoUrl directly, keep working.
      // -------------------------------------------------
      if (result.videoUrl) {
        setProgress(100);
        setStep(stepMessages.length - 1);
        setVideoReady(true);
        setDownloadUrl(result.videoUrl);
        return;
      }

      // -------------------------------------------------
      // MODE 2: NEW JOB FLOW
      // render-vx returns jobId, then frontend polls status endpoint.
      // -------------------------------------------------
      if (!result.jobId) {
        throw new Error("Render did not return jobId or videoUrl");
      }

      setCurrentJobId(result.jobId);
      setProgress((p) => Math.max(p, 8));
      setStep(1);

      const finalVideoUrl = await pollRenderJob({
        jobId: result.jobId,
        statusUrl: result.statusUrl,
      });

      if (!finalVideoUrl) {
        throw new Error("Render completed but no videoUrl was returned");
      }

      setProgress(100);
      setStep(stepMessages.length - 1);
      setVideoReady(true);
      setDownloadUrl(finalVideoUrl);
    } catch (err: any) {
      console.error("[RenderVX] handleRender error:", err);
      setDownloadError(
        err?.message || "Render completed with an issue. Please try again."
      );
    } finally {
      clearInterval(interval);
      clearInterval(stepInterval);
      setIsRendering(false);
    }
  };

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

      {/* VOICE STYLE */}
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
              type="button"
              disabled={isRendering}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* REALISM */}
      <div>
        <p className="text-gray-300 mb-2">Visual Realism</p>

        <input
          type="range"
          min={1}
          max={10}
          value={realism}
          onChange={(e) => setRealism(Number(e.target.value))}
          className="w-full"
          disabled={isRendering}
        />

        <p className="text-gray-400 text-sm mt-1">
          Current realism: {realism}/10 — {realismLabel}
        </p>

        <p className="text-gray-500 text-xs mt-1">
          Higher realism increases cinematic depth, shadows, lighting precision
          and overall clarity.
        </p>
      </div>

      {/* MUSIC MODE */}
      <div>
        <p className="text-gray-300 mb-2">Music Mode</p>

        <div className="flex flex-wrap gap-3">
          {["Auto", "Cinematic", "Fast", "Emotional", "Minimal", "Silent"].map(
            (m) => (
              <button
                key={m}
                onClick={() => setMusicMode(m)}
                className={pill(musicMode === m)}
                type="button"
                disabled={isRendering}
              >
                {m}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useTransitions}
              onChange={(e) => setUseTransitions(e.target.checked)}
              disabled={musicMode === "Silent" || isRendering}
            />
            Transitions
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useImpacts}
              onChange={(e) => setUseImpacts(e.target.checked)}
              disabled={musicMode === "Silent" || isRendering}
            />
            Impacts
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useAmbience}
              onChange={(e) => setUseAmbience(e.target.checked)}
              disabled={musicMode === "Silent" || isRendering}
            />
            Ambience
          </label>
        </div>

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

      {/* RENDER BUTTON */}
      {!videoReady && (
        <button
          onClick={handleRender}
          disabled={isRendering}
          className="w-full py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 transition disabled:opacity-60"
        >
          {isRendering ? "Rendering…" : "🎥 Create Video (Ultra HD)"}
        </button>
      )}

      {/* PROGRESS */}
      {isRendering && !videoReady && (
        <div className="space-y-4 pt-4">
          <div className="w-full h-3 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-blue-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-center text-gray-300">{stepMessages[step]}</p>

          {currentJobId && (
            <p className="text-center text-gray-500 text-xs">
              Render job active: {currentJobId}
            </p>
          )}
        </div>
      )}

      {/* VIDEO READY */}
      {videoReady && (
        <div className="space-y-6 pt-6">
          <div className="text-center text-emerald-300 font-semibold text-lg">
            ✓ Video Ready — Your Ultra HD reel is complete!
          </div>

          {downloadUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadMp4}
                disabled={isDownloading}
                className="block text-center py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
              >
                {isDownloading ? "Preparing MP4…" : "⬇️ Download MP4"}
              </button>

              <button
                type="button"
                onClick={handleOpenVideo}
                className="block text-center py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-600"
              >
                ▶️ Open Video
              </button>
            </div>
          )}

          {downloadError && (
            <p className="text-center text-sm text-red-400">{downloadError}</p>
          )}

          {affiliateLink && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-900/30 border border-emerald-500/20 text-center">
              <p className="text-emerald-300 font-medium">Affiliate Link Used</p>
              <code className="text-emerald-200 break-all">{affiliateLink}</code>
            </div>
          )}
        </div>
      )}

      {/* ERROR */}
      {!videoReady && downloadError && (
        <div className="pt-4">
          <p className="text-center text-sm text-red-400">{downloadError}</p>
        </div>
      )}
    </div>
  );
}