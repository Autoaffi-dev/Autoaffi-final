"use client";

import React from "react";
import { Film, Images, Layers } from "lucide-react";

type MediaType = "mixed" | "video" | "stills";

interface Props {
  mediaType: MediaType;
  setMediaType: (v: MediaType) => void;
}

export default function MediaTypeSelector({ mediaType, setMediaType }: Props) {
  const options = [
    {
      key: "mixed" as MediaType,
      label: "Mixed",
      desc: "Images + video blended",
      icon: <Layers size={22} />,
    },
    {
      key: "video" as MediaType,
      label: "Video",
      desc: "Pure B-roll source footage",
      icon: <Film size={22} />,
    },
    {
      key: "stills" as MediaType,
      label: "Stills",
      desc: "Cinematic images with movement",
      icon: <Images size={22} />,
    },
  ];

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Media Type
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {options.map((opt) => {
          const active = mediaType === opt.key;

          return (
<button
  key={opt.key}
  onClick={() => setMediaType(opt.key)}
  className={`
    rounded-xl p-4 text-left transition-all border flex flex-col justify-between min-h-[110px]
    ${active
      ? "border-emerald-400 bg-emerald-500/10 shadow-md"
      : "border-slate-700 hover:border-slate-500 hover:bg-slate-700/30"
    }
  `}
>
              <div className="flex items-center gap-2 text-slate-200">
                {opt.icon}
                <span className="font-semibold">{opt.label}</span>
              </div>

              <div className="text-xs text-slate-400 mt-2">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}