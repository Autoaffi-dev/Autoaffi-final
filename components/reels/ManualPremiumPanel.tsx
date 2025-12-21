"use client";

import React from "react";
import {
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Sparkles,
} from "lucide-react";

interface Props {
  imageFiles: File[];
  setImageFiles: (files: File[]) => void;

  videoFiles: File[];
  setVideoFiles: (files: File[]) => void;

  letAutoPickImages: boolean;
  setLetAutoPickImages: (v: boolean) => void;

  videoLength: number; // for the “Fill remainder with AI media” logic
}

export default function ManualPremiumPanel({
  imageFiles,
  setImageFiles,
  videoFiles,
  setVideoFiles,
  letAutoPickImages,
  setLetAutoPickImages,
  videoLength,
}: Props) {
  // -----------------------------
  // FILE HANDLERS
  // -----------------------------
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImageFiles([...imageFiles, ...files]);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setVideoFiles([...videoFiles, ...files]);
  };

  const removeImage = (index: number) => {
    const list = [...imageFiles];
    list.splice(index, 1);
    setImageFiles(list);
  };

  const removeVideo = (index: number) => {
    const list = [...videoFiles];
    list.splice(index, 1);
    setVideoFiles(list);
  };

  // -----------------------------
  // FILL REMAINING MEDIA LOGIC
  // -----------------------------
  const totalSecondsCovered =
    imageFiles.length * 2 + videoFiles.length * 3; // approx pacing weight

  const secondsMissing =
    videoLength - totalSecondsCovered > 0
      ? videoLength - totalSecondsCovered
      : 0;

  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-8">
      {/* HEADER */}
      <h2 className="text-lg font-semibold text-emerald-300 text-center">
        Manual Mode — Upload Your Media
      </h2>

      <p className="text-gray-300 text-sm text-center max-w-md mx-auto">
        Upload high-quality images and short clips. Autoaffi syncs pacing,
        voice, hooks and transitions automatically.
      </p>

      {/* ===================================== */}
      {/* AUTO-PICK TOGGLE */}
      {/* ===================================== */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => setLetAutoPickImages(!letAutoPickImages)}
          className={`px-4 py-2 rounded-xl border transition flex items-center gap-2 ${
            letAutoPickImages
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Auto-fill missing visuals using AI context
        </button>
      </div>

      {/* ===================================== */}
      {/* IMAGE UPLOAD */}
      {/* ===================================== */}
      <div>
        <p className="text-slate-300 text-sm font-semibold mb-2">Upload Images</p>

        <label className="cursor-pointer p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-300/30 transition block text-center">
          <ImageIcon className="w-6 h-6 text-emerald-300 mx-auto" />
          <span className="text-gray-300 text-sm">Click to upload images</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={handleImageUpload}
          />
        </label>

        {imageFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {imageFiles.map((file, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-emerald-300" />
                  <p className="text-gray-300 text-xs truncate">{file.name}</p>
                </div>

                <button
                  onClick={() => removeImage(i)}
                  className="text-red-400 text-xs hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===================================== */}
      {/* VIDEO UPLOAD */}
      {/* ===================================== */}
      <div>
        <p className="text-slate-300 text-sm font-semibold mb-2">Upload Videos</p>

        <label className="cursor-pointer p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-300/30 transition block text-center">
          <VideoIcon className="w-7 h-7 text-blue-300 mx-auto" />
          <span className="text-gray-300 text-sm">Click to upload short video clips</span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            multiple
            onChange={handleVideoUpload}
          />
        </label>

        {videoFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {videoFiles.map((file, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <VideoIcon className="w-5 h-5 text-blue-300" />
                  <p className="text-gray-300 text-xs truncate">{file.name}</p>
                </div>

                <button
                  onClick={() => removeVideo(i)}
                  className="text-red-400 text-xs hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===================================== */}
      {/* MISSING SECONDS INDICATOR */}
      {/* ===================================== */}
      {secondsMissing > 0 && (
        <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/30 mt-4">
          <p className="text-amber-300 text-sm font-semibold">
            Your uploads cover approx {totalSecondsCovered}s of your {videoLength}s reel.
          </p>
          <p className="text-amber-200 text-xs mt-1">
            Autoaffi will auto-generate ~{secondsMissing}s of filler visuals unless you upload more media.
          </p>
        </div>
      )}

      {/* ===================================== */}
      {/* INSTRUCTIONS */}
      {/* ===================================== */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 mt-4">
        <p className="text-gray-300 text-sm font-semibold mb-2">
          Tips for best results
        </p>

        <ul className="text-gray-400 text-xs space-y-1">
          <li>• Upload 3–8 images or clips for ideal pacing.</li>
          <li>• Use well-lit visuals to maximize AI storyboard quality.</li>
          <li>• Keep clips 1–3 seconds.</li>
          <li>• Autoaffi blends everything into story pacing automatically.</li>
        </ul>
      </div>
    </div>
  );
}