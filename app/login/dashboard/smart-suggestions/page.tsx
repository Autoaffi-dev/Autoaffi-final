"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type ProfileSuggestion = {
id: number;
name: string;
platform: "TikTok" | "Instagram" | "Facebook";
niche: string;
followers: string;
reason: string;
};

const MOCK_PROFILES: ProfileSuggestion[] = [
{
id: 1,
name: "@affiliatejourney",
platform: "TikTok",
niche: "Make money online",
followers: "32K",
reason: "Your content is also short-form & affiliate focused.",
},
{
id: 2,
name: "@sidehustlehub",
platform: "Instagram",
niche: "Side hustles",
followers: "18K",
reason: "They post carousels about passive income & tools like yours.",
},
{
id: 3,
name: "Affiliate Growth Circle",
platform: "Facebook",
niche: "Affiliate community",
followers: "5.2K members",
reason: "Group discussions fit your recurring income content.",
},
];

export default function SmartSuggestionsPage() {
const [autoLike, setAutoLike] = useState(false);
const [autoComment, setAutoComment] = useState(false);
const [copyMessage, setCopyMessage] = useState<string | null>(null);

const handleCopy = (profile: ProfileSuggestion) => {
const text = `Check out ${profile.name} on ${profile.platform} – niche: ${profile.niche}`;
if (navigator?.clipboard?.writeText) {
navigator.clipboard.writeText(text).catch(() => {});
}
setCopyMessage(`Copied ${profile.name} to clipboard.`);
setTimeout(() => setCopyMessage(null), 2000);
};

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
Smart Suggestions
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Autoaffi analyzes your niche and surfaces people, groups and pages
that are likely to engage with your content – without spammy
behaviour.
</p>
</motion.header>

{/* Settings */}
<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="grid gap-6 md:grid-cols-2"
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Engagement preferences
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<label className="flex items-center gap-2 text-slate-700">
<input
type="checkbox"
checked={autoLike}
onChange={(e) => setAutoLike(e.target.checked)}
/>
<span>
Show profiles where a like or follow is likely to be mutual.
</span>
</label>
<label className="flex items-center gap-2 text-slate-700">
<input
type="checkbox"
checked={autoComment}
onChange={(e) => setAutoComment(e.target.checked)}
/>
<span>
Prioritize posts where helpful comments could start a
conversation.
</span>
</label>
<p className="text-xs text-slate-500">
This is a planning assistant – Autoaffi will never auto-DM or
auto-spam users. You stay in full control.
</p>
</CardContent>
</Card>

<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Smart strategy tip
</CardTitle>
</CardHeader>
<CardContent className="space-y-3 text-sm text-slate-700">
<p>
For each new piece of content you post, manually engage with{" "}
<strong>5–10 suggested profiles</strong> in your niche:
</p>
<ul className="list-disc pl-5 space-y-1 text-xs md:text-sm">
<li>Leave one helpful comment (no links).</li>
<li>Save or like 1–2 posts you genuinely find useful.</li>
<li>Connect or follow only if it fits your brand.</li>
</ul>
<p className="text-xs text-slate-500">
This builds a real audience and keeps you compliant with
platform rules.
</p>
</CardContent>
</Card>
</motion.div>

{/* Suggested Profiles */}
<motion.section
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="space-y-4"
>
<div className="flex items-center justify-between">
<h2 className="text-base md:text-lg font-semibold text-slate-900">
Suggested profiles & groups (mock data)
</h2>
{copyMessage && (
<span className="text-xs text-emerald-700">{copyMessage}</span>
)}
</div>

<div className="grid gap-4 md:grid-cols-3">
{MOCK_PROFILES.map((p) => (
<Card key={p.id} className="border-slate-200 shadow-sm">
<CardHeader className="pb-2">
<CardTitle className="text-sm">{p.name}</CardTitle>
</CardHeader>
<CardContent className="space-y-2 text-xs text-slate-600">
<p>
<span className="font-semibold">Platform:</span>{" "}
{p.platform}
</p>
<p>
<span className="font-semibold">Niche:</span> {p.niche}
</p>
<p>
<span className="font-semibold">Audience:</span>{" "}
{p.followers}
</p>
<p className="text-[11px]">{p.reason}</p>
<Button
size="sm"
className="mt-1 w-full rounded-full bg-slate-900 text-[11px] font-semibold text-white hover:bg-slate-800"
onClick={() => handleCopy(p)}
>
Copy profile note
</Button>
</CardContent>
</Card>
))}
</div>
</motion.section>

<p className="text-xs text-slate-500 mt-6">
Looking for people <strong>outside</strong> your current network who
already show interest in affiliate marketing or making money online?{" "}
<Link
href="/login/dashboard/lead-detection"
className="text-amber-600 font-semibold hover:text-amber-700 transition-colors"
>
Try Lead Detection ↗
</Link>
</p>
</div>
</main>
);
}