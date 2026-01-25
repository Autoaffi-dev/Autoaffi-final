"use client";

import React from "react";
import CopyButton from "@/components/reels/CopyButton";

interface Props {
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

  handleMusicUpload: (e: any) => void;
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

export default function ResultPreview(props: Props) {
  const {
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
  } = props;

  // If nothing generated yet → Show nothing
  if (!result) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-8">

      {/* ---------------------------------------------------------------- */}
      {/* REEL BLUEPRINT SUMMARY (Simple Header) */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <h3 className="text-sm font-semibold text-emerald-300">
          Reel Blueprint Ready
        </h3>
        <p className="text-gray-400 text-xs">
          This is your fully structured reel — script, storyboard, pacing, metadata & CTA ready.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* SCRIPT DROPDOWN (small + clean) */}
      {/* ---------------------------------------------------------------- */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
        <button
          onClick={() => setShowScript(!showScript)}
          className="w-full text-left px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-slate-800/40"
        >
          🎬 Script (click to {showScript ? "hide" : "show"})
        </button>

        {showScript && (
          <div className="px-4 py-3 text-gray-300 text-sm whitespace-pre-wrap border-t border-slate-800">
            {(result.script || []).join("\n")}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* SUBTITLES (CLEAN LIST) */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <h4 className="text-emerald-300 font-semibold text-sm mb-1">Subtitles</h4>
        <ul className="space-y-1 text-xs text-gray-200">
          {(result.subtitles || []).map((s: any, i: number) => (
            <li key={i} className="border-b border-slate-800 pb-1">
              {s.text}
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RENDER BLOCK — keeps ALL VX functionality */}
      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4 p-5 rounded-xl bg-slate-950/50 border border-slate-800">

        <h4 className="text-sm font-semibold text-emerald-300">
          Autoaffi VX — Ultra HD Video Render
        </h4>

        {/* Voice */}
        <div>
          <label className="text-xs text-gray-300">Voice Style</label>
          <select
            value={voiceStyle}
            onChange={(e) => setVoiceStyle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-gray-200 rounded-lg p-2 text-xs"
          >
            <option value="default">Natural</option>
            <option value="deep">Deep</option>
            <option value="female">Female</option>
          </select>
        </div>

        {/* Realism */}
        <div>
          <label className="text-xs text-gray-300">Visual Realism</label>
          <input
            type="range"
            min={0}
            max={100}
            value={realism}
            onChange={(e) => setRealism(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Music Mode */}
        <div>
          <label className="text-xs text-gray-300">Music Mode</label>
          <select
            value={musicMode}
            onChange={(e) => setMusicMode(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-700 text-gray-200 rounded-lg p-2 text-xs"
          >
            <option value="auto">Auto (Recommended)</option>
            <option value="upload">Upload</option>
            <option value="library">Library</option>
          </select>
        </div>

        {/* Autoaffi preset */}
        <button
          onClick={applyAutoaffiMode}
          className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          Autoaffi Mode (Recommended)
        </button>

        {/* Render Button */}
        <button
          onClick={startRenderVX}
          disabled={isRendering}
          className="w-full py-3 rounded-xl font-semibold bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          {isRendering ? "Rendering…" : "Create Video (Ultra HD)"}
        </button>

        {/* Render finished */}
        {renderedVideo && !isRendering && (
          <button
            onClick={downloadRenderedVideo}
            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            ⬇️ Download MP4
          </button>
        )}
      </div>
    </div>
  );
}