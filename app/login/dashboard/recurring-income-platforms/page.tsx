"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlatformRow = {
name: string;
category: string;
commission: string;
recurring: string;
notes: string;
};

const PLATFORMS: PlatformRow[] = [
{
name: "TubeMagic",
category: "YouTube / Faceless",
commission: "30–40% recurring",
recurring: "Yes",
notes: "Perfect for faceless channels & automation content.",
},
{
name: "Pictory",
category: "Video AI",
commission: "20–30% recurring",
recurring: "Yes",
notes: "Turn scripts into videos – great for TikTok & Reels.",
},
{
name: "InVideo",
category: "Video AI",
commission: "Recurring",
recurring: "Yes",
notes: "Templates + stock content for social ads.",
},
{
name: "Jasper",
category: "AI Copywriting",
commission: "Recurring",
recurring: "Yes",
notes: "Good for long-form content, sales pages & emails.",
},
{
name: "Writesonic",
category: "AI Copywriting",
commission: "Recurring",
recurring: "Yes",
notes: "Blog + landing page focus.",
},
{
name: "Descript",
category: "Podcast / Video",
commission: "Recurring",
recurring: "Yes",
notes: "Great if your audience does podcasts or YouTube.",
},
{
name: "Canva Pro",
category: "Design",
commission: "One-time / recurring hybrid",
recurring: "Partial",
notes: "Templates, thumbnails & social posts.",
},
{
name: "Metricool",
category: "Scheduling / Analytics",
commission: "Recurring",
recurring: "Yes",
notes: "Pairs perfectly with Autoaffi scheduling.",
},
// ... fyll på fler senare om du vill
];

const CATEGORIES = [
"All",
"YouTube / Faceless",
"Video AI",
"AI Copywriting",
"Podcast / Video",
"Design",
"Scheduling / Analytics",
] as const;

type CategoryFilter = (typeof CATEGORIES)[number];

export default function RecurringIncomePlatformsPage() {
const [filter, setFilter] = useState<CategoryFilter>("All");

const filtered = PLATFORMS.filter((p) =>
filter === "All" ? true : p.category === filter
);

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
Recurring Income – AI Platforms
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
These are affiliate tools that pay{" "}
<span className="font-semibold">recurring commissions</span>. Autoaffi
helps you organize links, track clicks and match offers to your content
strategy.
</p>
</motion.header>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="flex flex-wrap gap-3"
>
{CATEGORIES.map((cat) => (
<button
key={cat}
onClick={() => setFilter(cat)}
className={`rounded-full border px-3 py-1 text-xs md:text-sm transition ${
filter === cat
? "border-slate-900 bg-slate-900 text-white"
: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
}`}
>
{cat}
</button>
))}
</motion.div>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
>
<Card className="border-slate-200 shadow-sm">
<CardHeader className="pb-3">
<CardTitle className="text-base md:text-lg">
Platforms overview
</CardTitle>
</CardHeader>
<CardContent className="overflow-x-auto">
<table className="min-w-full text-left text-xs md:text-sm">
<thead>
<tr className="border-b border-slate-100 text-slate-500">
<th className="py-2 pr-4">Platform</th>
<th className="py-2 pr-4">Category</th>
<th className="py-2 pr-4">Commission</th>
<th className="py-2 pr-4">Recurring</th>
<th className="py-2">Notes</th>
</tr>
</thead>
<tbody>
{filtered.map((p) => (
<tr key={p.name} className="border-b border-slate-50">
<td className="py-2 pr-4 font-semibold text-slate-800">
{p.name}
</td>
<td className="py-2 pr-4 text-slate-600">{p.category}</td>
<td className="py-2 pr-4 text-slate-600">{p.commission}</td>
<td className="py-2 pr-4">
<span
className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
p.recurring === "Yes"
? "bg-emerald-50 text-emerald-700"
: "bg-slate-100 text-slate-600"
}`}
>
{p.recurring}
</span>
</td>
<td className="py-2 text-slate-600">{p.notes}</td>
</tr>
))}
</tbody>
</table>
{filtered.length === 0 && (
<p className="py-4 text-xs text-slate-500">
No platforms in this category yet. We’ll keep adding more.
</p>
)}
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}