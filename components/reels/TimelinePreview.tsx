"use client";

import React, { useMemo, useState } from "react";

interface TimelinePreviewProps {
  result: any;
  videoLength: number;
}

interface SceneSegment {
  label: string;
  start: number;
  end: number;
}

interface VoiceSegment {
  label: string;
  start: number;
  end: number;
}

export default function TimelinePreview({
  result,
  videoLength,
}: TimelinePreviewProps) {
  const [open, setOpen] = useState(true);

  const totalDuration = Math.max(videoLength || 30, 5); // minst 5 sek för vettig skala

  // ============================
  // SCENES
  // ============================
  const scenes: SceneSegment[] = useMemo(() => {
    const raw = Array.isArray(result?.scenes) ? result.scenes : [];

    if (!raw.length) {
      return [
        {
          label: "Full video",
          start: 0,
          end: totalDuration,
        },
      ];
    }

    // Försök läsa start/end om de finns, annars fördela jämnt
    const haveExplicitTimes = raw.some(
      (s: any) =>
        typeof s?.start === "number" ||
        typeof s?.startTime === "number" ||
        typeof s?.time === "number"
    );

    if (!haveExplicitTimes) {
      const count = raw.length;
      return raw.map((s: any, idx: number) => {
        const start = (idx * totalDuration) / count;
        const end = ((idx + 1) * totalDuration) / count;
        const label =
          typeof s?.label === "string"
            ? s.label
            : typeof s?.title === "string"
            ? s.title
            : `Scene ${idx + 1}`;
        return { label, start, end };
      });
    }

    // Om vi HAR tider – försök använda dem
    const mapped = raw
      .map((s: any, idx: number): SceneSegment | null => {
        const start =
          typeof s?.start === "number"
            ? s.start
            : typeof s?.startTime === "number"
            ? s.startTime
            : typeof s?.time === "number"
            ? s.time
            : (idx * totalDuration) / raw.length;

        const end =
          typeof s?.end === "number"
            ? s.end
            : typeof s?.endTime === "number"
            ? s.endTime
            : Math.min(start + totalDuration / raw.length, totalDuration);

        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

        const label =
          typeof s?.label === "string"
            ? s.label
            : typeof s?.title === "string"
            ? s.title
            : `Scene ${idx + 1}`;

        return {
          label,
          start: Math.max(0, Math.min(start, totalDuration)),
          end: Math.max(0, Math.min(end, totalDuration)),
        };
      })
      .filter(Boolean) as SceneSegment[];

    return mapped.length
      ? mapped
      : [
          {
            label: "Full video",
            start: 0,
            end: totalDuration,
          },
        ];
  }, [result?.scenes, totalDuration]);

  // ============================
  // VOICE TIMELINE
  // ============================
  const voiceSegments: VoiceSegment[] = useMemo(() => {
    const raw = Array.isArray(result?.voiceTimeline)
      ? result.voiceTimeline
      : [];

    if (!raw.length) return [];

    return raw
      .map((v: any, idx: number): VoiceSegment | null => {
        const start =
          typeof v?.start === "number"
            ? v.start
            : typeof v?.time === "number"
            ? v.time
            : (idx * totalDuration) / raw.length;

        const end =
          typeof v?.end === "number"
            ? v.end
            : typeof v?.endTime === "number"
            ? v.endTime
            : Math.min(start + totalDuration / raw.length, totalDuration);

        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

        const label =
          typeof v?.label === "string"
            ? v.label
            : typeof v?.text === "string"
            ? v.text
            : `Line ${idx + 1}`;

        return {
          label,
          start: Math.max(0, Math.min(start, totalDuration)),
          end: Math.max(0, Math.min(end, totalDuration)),
        };
      })
      .filter(Boolean) as VoiceSegment[];
  }, [result?.voiceTimeline, totalDuration]);

  // ============================
  // BEAT MAP
  // ============================
  const beats: number[] = useMemo(() => {
    const raw = Array.isArray(result?.beatMap) ? result.beatMap : [];

    return raw
      .map((b: any) => {
        if (typeof b === "number") return b;
        if (typeof b?.time === "number") return b.time;
        if (typeof b?.t === "number") return b.t;
        return null;
      })
      .filter((x): x is number => Number.isFinite(x))
      .map((t) => Math.max(0, Math.min(t, totalDuration)));
  }, [result?.beatMap, totalDuration]);

  const formatTime = (seconds: number) => {
    const s = Math.round(seconds);
    return `${s}s`;
  };

  const renderSegmentsRow = (
    segments: { start: number; end: number; label: string }[],
    level: "primary" | "secondary"
  ) => {
    if (!segments.length) {
      return (
        <div className="w-full h-6 rounded-full bg-slate-900/70 border border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
          No data yet – generate a reel to see the timeline.
        </div>
      );
    }

    return (
      <div className="relative w-full h-6 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden">
        {segments.map((seg, idx) => {
          const width =
            ((Math.max(seg.end - seg.start, 0.3) / totalDuration) * 100) || 0;
          const left = ((seg.start / totalDuration) * 100) || 0;

          const bgClass =
            level === "primary"
              ? "bg-emerald-500/50"
              : "bg-cyan-500/40";

          return (
            <div
              key={`${seg.label}-${idx}-${seg.start}-${seg.end}`}
              className={`absolute top-0 bottom-0 ${bgClass} border border-black/30`}
              style={{
                left: `${left}%`,
                width: `${Math.min(width, 100)}%`,
              }}
              title={`${seg.label} (${formatTime(seg.start)} – ${formatTime(
                seg.end
              )})`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-emerald-400/40 bg-slate-950/70 p-5 space-y-4">
      {/* HEADER */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-emerald-200 text-sm font-semibold"
      >
        <span>Timeline Preview (Beast Mode)</span>
        <span className="text-xs text-emerald-300">
          {formatTime(totalDuration)} · {scenes.length} scenes
          {voiceSegments.length ? ` · ${voiceSegments.length} voice lines` : ""}
          {beats.length ? ` · ${beats.length} beats` : ""}
        </span>
      </button>

      {!open ? null : (
        <div className="space-y-5">
          {/* TIME SCALE */}
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0s</span>
            <span>{formatTime(totalDuration)}</span>
          </div>

          <div className="space-y-3">
            {/* SCENES ROW */}
            <div className="space-y-1">
              <p className="text-[11px] text-slate-300 font-medium">
                Scenes & pacing
              </p>
              {renderSegmentsRow(scenes, "primary")}
            </div>

            {/* VOICE ROW */}
            <div className="space-y-1">
              <p className="text-[11px] text-slate-300 font-medium">
                Voice lines
              </p>
              {renderSegmentsRow(voiceSegments, "secondary")}
            </div>

            {/* BEATS ROW */}
            <div className="space-y-1">
              <p className="text-[11px] text-slate-300 font-medium">
                Music beats & impacts
              </p>
              <div className="relative w-full h-6 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden">
                {beats.map((t, idx) => {
                  const left = (t / totalDuration) * 100;
                  return (
                    <div
                      key={`${t}-${idx}`}
                      className="absolute top-0 bottom-0 w-[2px] bg-emerald-400/70"
                      style={{ left: `${left}%` }}
                      title={`Beat at ${formatTime(t)}`}
                    />
                  );
                })}
                {!beats.length && (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                    No beat data yet – will be filled when music is generated.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-emerald-300 font-semibold mb-0.5">
                Avg. scene length
              </p>
              <p className="text-slate-300">
                {scenes.length
                  ? formatTime(totalDuration / scenes.length)
                  : "–"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-emerald-300 font-semibold mb-0.5">
                Voice coverage
              </p>
              <p className="text-slate-300">
                {voiceSegments.length
                  ? `${voiceSegments.length} lines`
                  : "No voice segments"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-emerald-300 font-semibold mb-0.5">
                Beat density
              </p>
              <p className="text-slate-300">
                {beats.length
                  ? `${Math.round(beats.length / (totalDuration / 10))} beats / 10s`
                  : "No beat data"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}