"use client";

import type { GeneratedPush } from "../types";
import PushDayCard from "./PushDayCard";
import PushSummaryPanel from "./PushSummaryPanel";

type PushResultsPanelProps = {
  push: GeneratedPush;
  onRegenerateDay: (dayNumber: number) => void;
};

export default function PushResultsPanel({
  push,
  onRegenerateDay,
}: PushResultsPanelProps) {
  return (
    <div className="space-y-6">
      <PushSummaryPanel push={push} />

      <section className="space-y-4">
        {push.days.map((day) => (
          <PushDayCard
            key={day.dayNumber}
            day={day}
            onRegenerateDay={onRegenerateDay}
          />
        ))}
      </section>
    </div>
  );
}