"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformanceScorePage() {
const [postsPerWeek, setPostsPerWeek] = useState(7);
const [usesAutoPosting, setUsesAutoPosting] = useState(true);
const [leveragesRecurring, setLeveragesRecurring] = useState(true);

const score = useMemo(() => {
let base = Math.min(postsPerWeek * 5, 60); // upp till 60 poäng på aktivitet
if (usesAutoPosting) base += 15;
if (leveragesRecurring) base += 20;
return Math.min(base, 100);
}, [postsPerWeek, usesAutoPosting, leveragesRecurring]);

const estimatedWeekly = useMemo(() => {
// Extremt grov mock-formel
const base = postsPerWeek * 3;
const recurringBoost = leveragesRecurring ? 1.6 : 1.0;
const autoBoost = usesAutoPosting ? 1.2 : 1.0;
return Math.round(base * recurringBoost * autoBoost);
}, [postsPerWeek, usesAutoPosting, leveragesRecurring]);

return (
<main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
<div className="mx-auto flex max-w-5xl flex-col gap-8">
<motion.header
initial={{ opacity: 0, y: 18 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-3"
>
<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
Performance Score
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
This is your “success barrier” view inside the app. Adjust your habits and see
a rough estimate of how strong your setup is for affiliate growth.
</p>
</motion.header>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="grid gap-6 md:grid-cols-2"
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Your consistency
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
Posts per week (across all platforms)
</label>
<input
type="range"
min={0}
max={21}
value={postsPerWeek}
onChange={(e) => setPostsPerWeek(Number(e.target.value))}
className="w-full"
/>
<p className="text-xs text-slate-600">
You’ve set: <strong>{postsPerWeek}</strong> posts / week
</p>
</div>

<label className="flex items-center gap-2 text-xs md:text-sm text-slate-700">
<input
type="checkbox"
checked={usesAutoPosting}
onChange={(e) => setUsesAutoPosting(e.target.checked)}
/>
I plan to use Autoaffi’s scheduling / auto-posting (Elite feature).
</label>

<label className="flex items-center gap-2 text-xs md:text-sm text-slate-700">
<input
type="checkbox"
checked={leveragesRecurring}
onChange={(e) => setLeveragesRecurring(e.target.checked)}
/>
I actively promote recurring income offers (AI tools, SaaS, etc.).
</label>

<p className="text-[11px] text-slate-500">
This is not a guarantee of income – it’s a planning tool. You still need
to create value-adding content and follow each platform’s rules.
</p>
</CardContent>
</Card>

<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Score & rough estimate
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<div>
<p className="text-xs font-medium text-slate-600 mb-1">
Performance score
</p>
<div className="flex items-center gap-3">
<div className="relative h-20 w-20 rounded-full bg-slate-100">
<div className="absolute inset-2 rounded-full bg-slate-900 flex items-center justify-center">
<span className="text-xl font-extrabold text-yellow-400">
{score}
</span>
</div>
</div>
<p className="text-xs text-slate-600">
Above <strong>70</strong> means you’re giving yourself a real chance –
assuming you post consistently and stay in your niche.
</p>
</div>
</div>

<div>
<p className="text-xs font-medium text-slate-600 mb-1">
Very rough weekly earning potential (USD)
</p>
<p className="text-3xl font-extrabold text-yellow-500">
~${estimatedWeekly}
</p>
<p className="mt-1 text-[11px] text-slate-500">
This assumes active posting, optimized links, and that you drive traffic
to relevant offers. It’s a planning estimate, not a promise.
</p>
</div>
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}
