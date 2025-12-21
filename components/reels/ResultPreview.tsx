"use client";

import React from "react";

interface StoryboardFrame {
  time: number;
  description: string;
}

interface ResultPreviewProps {
  result: any;

  showScript: boolean;
  setShowScript: (v: boolean) => void;

  videoLength: number;
  mainPlatform: string;
  genre: string;
  tone: string;
  storyFormat: string;

  voiceStyle: string;
  setVoiceStyle: (v: string) => void;

  realism: number;
  setRealism: (v: number) => void;

  musicMode: "auto" | "upload" | "library";
  setMusicMode: (v: "auto" | "upload" | "library") => void;

  musicStyle: string;
  setMusicStyle: (v: string) => void;

  soundTransitions: boolean;
  setSoundTransitions: (v: boolean) => void;

  soundImpacts: boolean;
  setSoundImpacts: (v: boolean) => void;

  soundAmbience: boolean;
  setSoundAmbience: (v: boolean) => void;

  handleMusicUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  applyAutoaffiMode: () => void;

  startRenderVX: () => void;
  isRendering: boolean;
  renderedVideo: string | null;
  downloadRenderedVideo: () => void;

  hashtags: string[];
  titleIdeas: string[];
  captionIdeas: string[];
  bestPostingTimes: string[];

  recommendedTitle: string | null;
  setRecommendedTitle: (v: string | null) => void;

  recommendedCaption: string | null;
  setRecommendedCaption: (v: string | null) => void;

  recommendedHashtags: string[];
  setRecommendedHashtags: (v: string[]) => void;
}

export default function ResultPreview({
  result,

  showScript,
  setShowScript,

  videoLength,
  mainPlatform,
  genre,
  tone,
  storyFormat,

  voiceStyle,
  setVoiceStyle,

  realism,
  setRealism,

  musicMode,
  setMusicMode,

  musicStyle,
  setMusicStyle,

  soundTransitions,
  setSoundTransitions,

  soundImpacts,
  setSoundImpacts,

  soundAmbience,
  setSoundAmbience,

  handleMusicUpload,

  applyAutoaffiMode,

  startRenderVX,
  isRendering,
  renderedVideo,
  downloadRenderedVideo,

  hashtags,
  titleIdeas,
  captionIdeas,
  bestPostingTimes,

  recommendedTitle,
  setRecommendedTitle,

  recommendedCaption,
  setRecommendedCaption,

  recommendedHashtags,
  setRecommendedHashtags,
}: ResultPreviewProps) {
  if (!result) return null;

  return (
    <section className="mb-10 rounded-2xl border border-slate-700/70 bg-slate-950/90 p-5 text-sm">

      {/* HEADER */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1">
            Reel blueprint ready
          </h2>
          <p className="text-[11px] text-slate-400 max-w-md">
            This is your fully structured reel — script, storyboard, pacing and CTA.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            {videoLength}s · 9:16 · {mainPlatform}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-300">
            {genre} · {tone}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-300">
            {storyFormat}
          </span>
        </div>
      </div>

      {/* GRID */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1.2fr]">

        {/* LEFT SIDE */}
        <div className="space-y-6">

          {/* SCRIPT */}
          <div className="border border-slate-700/70 rounded-xl bg-slate-900/70">
            <button
              onClick={() => setShowScript(!showScript)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/40 transition"
            >
              <span>📜 Script (click to {showScript ? "hide" : "show"})</span>
              <span className="text-emerald-300">{showScript ? "▲" : "▼"}</span>
            </button>

            {showScript && (
              <div className="px-4 py-3 text-[11px] text-slate-300 whitespace-pre-line">
                {result.script}
              </div>
            )}
          </div>

          {/* STORYBOARD */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
              Timeline preview
            </h3>

            <ul className="space-y-2 text-xs text-slate-300">
              {result.storyboard?.map((frame: StoryboardFrame, idx: number) => (
                <li
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 min-w-[52px] items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-emerald-300 border border-slate-700">
                      {frame.time.toFixed(1)}s
                    </span>

                    <div className="space-y-1">
                      <p className="text-xs text-slate-100">{frame.description}</p>
                      <p className="text-[10px] text-emerald-300/85">
                        Visual cue: {videoLength <= 30
                          ? "tight framing, fast cuts"
                          : videoLength <= 60
                          ? "smooth pacing"
                          : "cinematic pacing"}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* SUBTITLES */}
          {result.subtitles?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Subtitles (lines)
              </h3>

              <ul className="space-y-1 max-h-40 overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
                {result.subtitles.map((line: string, idx: number) => (
                  <li key={idx}>• {line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
              Call to action
            </h3>
            <p className="text-xs text-emerald-200 bg-slate-950/80 border border-emerald-400/40 rounded-xl p-3">
              {result.cta}
            </p>
          </div>
          {/* AUTOAFFI VX RENDER ENGINE */}
          <div className="mt-10 space-y-6 rounded-2xl bg-slate-900/80 border border-slate-700/60 p-6">

            <h3 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Autoaffi VX — Ultra HD Video Render
            </h3>
            <p className="text-[11px] text-center text-slate-400 -mt-2">
              Genre, tone, story format & media type sync into render.
            </p>

            {/* VOICE STYLE */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                🎧 Voice Style
              </label>
              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
              >
                <option value="natural">Natural</option>
                <option value="deep">Deep</option>
                <option value="female-soft">Female Soft</option>
                <option value="male-energetic">Male Energetic</option>
                <option value="radio">Radio</option>
              </select>
            </div>

            {/* VISUAL REALISM */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                🎭 Visual realism
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={realism}
                onChange={(e) => setRealism(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* MUSIC & SOUND PANEL */}
            <div className="space-y-4 rounded-2xl bg-slate-900/70 border border-slate-700/60 p-4">

              <h3 className="text-sm font-semibold text-slate-200">
                🎵 Music & Sound Design
              </h3>

              {/* MUSIC MODE */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Music Mode
                </label>
                <select
                  value={musicMode}
                  onChange={(e) =>
                    setMusicMode(e.target.value as "auto" | "upload" | "library")
                  }
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="library">Pick a style</option>
                  <option value="upload">Upload your own</option>
                </select>
              </div>

              {/* MUSIC STYLE PICKER */}
              {musicMode === "library" && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Choose Style
                  </label>
                  <select
                    value={musicStyle}
                    onChange={(e) => setMusicStyle(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs px-3 py-2 text-slate-200"
                  >
                    <option value="cinematic">Cinematic</option>
                    <option value="emotional">Emotional</option>
                    <option value="energetic">Energetic</option>
                    <option value="dark">Dark</option>
                    <option value="minimal">Minimal</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </div>
              )}

              {/* MUSIC UPLOAD */}
              {musicMode === "upload" && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Upload audio file
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleMusicUpload}
                    className="block w-full text-xs text-slate-300"
                  />
                </div>
              )}

              {/* SOUND CHECKBOXES */}
              <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={soundTransitions}
                    onChange={(e) => setSoundTransitions(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Transitions
                </label>

                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={soundImpacts}
                    onChange={(e) => setSoundImpacts(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Impacts
                </label>

                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={soundAmbience}
                    onChange={(e) => setSoundAmbience(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Ambience
                </label>
              </div>
            </div>

            {/* AUTOAFFI MODE BUTTON */}
            <button
              onClick={applyAutoaffiMode}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-semibold text-sm hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition"
            >
              ✨ Autoaffi Mode (Recommended Setup)
            </button>

            {/* RENDER BUTTON */}
            <button
              onClick={startRenderVX}
              disabled={isRendering}
              className="w-full py-3 rounded-xl mt-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition"
            >
              {isRendering ? "Rendering Video…" : "🎬 Create Video (Ultra HD)"}
            </button>

            {isRendering && (
              <p className="text-center text-[11px] text-emerald-300 mt-2">
                Rendering… Please wait.
              </p>
            )}

            {renderedVideo && (
              <>
                <button
                  onClick={downloadRenderedVideo}
                  className="w-full py-2.5 rounded-lg bg-white text-slate-900 text-sm font-semibold shadow-md"
                >
                  📥 Download MP4
                </button>
                <p className="mt-1 text-[10px] text-slate-400 text-center">
                  Generated by Autoaffi VX.
                </p>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — SOCIAL HINTS + OFFER META */}
        <div className="space-y-6">

          {/* SOCIAL HINTS */}
          {(hashtags.length > 0 ||
            titleIdeas.length > 0 ||
            captionIdeas.length > 0 ||
            bestPostingTimes.length > 0) && (

            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-3">
              <h3 className="text-xs font-semibold text-emerald-200 mb-2">
                Smart Social Hints
              </h3>

              {/* APPLY ALL */}
              <div className="rounded-xl bg-slate-900/70 border border-emerald-400/40 px-4 py-3 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-emerald-300">
                    ⭐ Autoaffi Recommended Social Setup
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      const t = titleIdeas?.[0] ?? null;
                      const c = captionIdeas?.[0] ?? null;
                      const h = hashtags?.slice(0, 5) ?? [];
                      setRecommendedTitle(t);
                      setRecommendedCaption(c);
                      setRecommendedHashtags(h);
                    }}
                    className="rounded-full bg-emerald-600/20 px-3 py-1 text-[10px] text-emerald-200 hover:bg-emerald-600/30 transition"
                  >
                    Apply All
                  </button>
                </div>
                <p className="text-[10px] text-emerald-200/80 mt-1">
                  Autoaffi picks your optimal social metadata.
                </p>
              </div>

              {/* HASHTAGS */}
              {hashtags.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                    Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`rounded-full px-2 py-0.5 border ${
                          recommendedHashtags.includes(tag)
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                            : "bg-slate-950/80 border-emerald-400/40 text-emerald-100"
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TITLES */}
              {titleIdeas.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                    Title Ideas
                  </p>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    {titleIdeas.map((t, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg px-2 py-1 border transition ${
                          recommendedTitle === t
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                            : "bg-slate-950/70 border-emerald-400/40 text-slate-200"
                        }`}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CAPTIONS */}
              {captionIdeas.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                    Captions
                  </p>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    {captionIdeas.map((c, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg px-2 py-1 border transition ${
                          recommendedCaption === c
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                            : "bg-slate-950/70 border-emerald-400/40 text-slate-200"
                        }`}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* POSTING TIMES */}
              {bestPostingTimes.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-emerald-200 mb-1">
                    Suggested Posting Times
                  </p>
                  <p className="text-[11px] text-emerald-50">
                    {bestPostingTimes.join(" · ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* OFFER META (OPTIONAL) */}
          {result.offerMeta && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
              <h3 className="text-xs font-semibold text-slate-200 mb-2">
                Offer attached to this reel
              </h3>
              <p className="text-xs text-slate-300">{result.offerMeta.name}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}