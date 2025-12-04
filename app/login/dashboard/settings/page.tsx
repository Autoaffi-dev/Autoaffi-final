"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FREQUENCIES = [
{ value: "manual", label: "Manual only" },
{ value: "1-per-day", label: "1 post per day" },
{ value: "2-per-day", label: "2 posts per day" },
{ value: "3-per-day", label: "3 posts per day" },
] as const;

type Frequency = (typeof FREQUENCIES)[number]["value"];

export default function SettingsPage() {
const [frequency, setFrequency] = useState<Frequency>("manual");
const [includeWeekends, setIncludeWeekends] = useState(true);
const [saved, setSaved] = useState(false);

const handleSave = () => {
setSaved(true);
setTimeout(() => setSaved(false), 2000);
};

return (
<main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
<div className="mx-auto flex max-w-4xl flex-col gap-8">
<motion.header
initial={{ opacity: 0, y: 18 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-3"
>
<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
Auto-posting Settings (Elite)
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Decide how aggressive Autoaffi should be with scheduling and posting content
across your connected social accounts.
</p>
</motion.header>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Posting frequency
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<div className="space-y-2">
<p className="text-slate-700 text-sm">
How often should Autoaffi schedule posts for you?
</p>
<div className="grid gap-2 md:grid-cols-2">
{FREQUENCIES.map((f) => (
<button
key={f.value}
onClick={() => setFrequency(f.value)}
className={`rounded-2xl border px-4 py-2 text-left text-sm transition ${
frequency === f.value
? "border-slate-900 bg-slate-900 text-white"
: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
}`}
>
{f.label}
</button>
))}
</div>
</div>

<label className="mt-2 flex items-center gap-2 text-xs md:text-sm text-slate-700">
<input
type="checkbox"
checked={includeWeekends}
onChange={(e) => setIncludeWeekends(e.target.checked)}
/>
Include weekends in scheduling
</label>

<p className="text-xs text-slate-500">
Autoaffi will always let you review posts before publishing (unless you
explicitly enable “auto-approve” later). For now, this is a planning
setting.
</p>

<Button
onClick={handleSave}
className="mt-2 rounded-full bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
>
Save preferences (mock)
</Button>
{saved && (
<p className="mt-1 text-xs text-emerald-700">
Preferences stored in local state for now – DB integration comes later.
</p>
)}
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}