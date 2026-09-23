"use client";

import React from "react";
import { Film } from "lucide-react";

type MediaType = "mixed" | "video" | "stills";

interface Props {
  mediaType: MediaType;
  setMediaType: (v: MediaType) => void;
}

export default function MediaTypeSelector({ mediaType, setMediaType }: Props) {
  const active = mediaType === "video";

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Media Type
      </h3>

      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => setMediaType("video")}
          className={`
            rounded-xl p-4 text-left transition-all border flex flex-col justify-between min-h-[110px]
            ${active
              ? "border-emerald-400 bg-emerald-500/10 shadow-md"
              : "border-slate-700 hover:border-slate-500 hover:bg-slate-700/30"
            }
          `}
        >
          <div className="flex items-center gap-2 text-slate-200">
            <Film size={22} />
            <span className="font-semibold">Video</span>
          </div>

          <div className="text-xs text-slate-400 mt-2">
            Autoaffi Reels always use video clips. Still images are not used as scene media.
          </div>
        </button>
      </div>
    </div>
  );
}
