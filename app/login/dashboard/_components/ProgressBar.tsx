"use client";

interface ProgressBarProps {
  value: number; // 0–100
}

export default function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-yellow-400 transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}