export interface BeatMark {
  time: number;
  type: "impact" | "transition" | "drop" | "soft";
  intensity: "low" | "medium" | "high";
}

export interface VoiceTimelineEntry {
  start: number;
  end: number;
  text: string;
  emphasis?: "normal" | "strong" | "whisper";
}

export interface ExportScene {
  index: number;
  start: number;
  end: number;
  label: string;
  mediaHint: "image" | "video" | "mixed";
  overlayText?: string;
}

export interface ExportTimeline {
  totalDuration: number;
  scenes: ExportScene[];
}