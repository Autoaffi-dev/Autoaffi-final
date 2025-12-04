"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function ViralHeadsUpPage() {
return (
<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
<div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6 }}
className="mb-10"
>
<h1 className="text-3xl font-extrabold text-yellow-300 mb-3">
Viral Heads-Up
</h1>
<p className="text-slate-400 text-sm max-w-2xl">
Stay ahead of trending content in your niche. Autoaffi scans
platforms like TikTok, Instagram and YouTube to detect creators and
topics gaining rapid attention — so you can engage early and grow
faster.
</p>
</motion.div>

{/* Trending Topics Section */}
<section className="grid gap-6 md:grid-cols-2 mb-12">
{[
{
platform: "TikTok",
trend: "AI Side Hustles",
change: "+38%",
tip: "Comment early on trending videos with AI tools – visibility is 3x higher.",
},
{
platform: "Instagram Reels",
trend: "Work from home hacks",
change: "+27%",
tip: "Use Reels Remix on viral clips to ride their exposure wave.",
},
{
platform: "YouTube Shorts",
trend: "Automation for creators",
change: "+44%",
tip: "Post Shorts 30–60s long with an actionable CTA near the end.",
},
{
platform: "Facebook Reels",
trend: "Affiliate success stories",
change: "+21%",
tip: "Add emotional storytelling to stand out from generic advice.",
},
].map((item, idx) => (
<motion.article
key={idx}
whileHover={{ scale: 1.02 }}
className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-yellow-400/60 transition-all duration-300"
>
<h2 className="text-lg font-semibold text-yellow-300 mb-1">
{item.platform}
</h2>
<p className="text-sm text-slate-100 mb-2">
Trending topic: <span className="font-semibold">{item.trend}</span>
</p>
<p className="text-xs text-emerald-400 mb-2">
Reach growth: {item.change}
</p>
<p className="text-xs text-slate-400 mb-4">{item.tip}</p>
<Link
href="/login/dashboard/smart-suggestions"
className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-300 hover:text-yellow-200"
>
See Smart Suggestions ↗
</Link>
</motion.article>
))}
</section>

{/* CTA */}
<motion.div
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ duration: 0.6 }}
className="text-center"
>
<p className="text-slate-400 mb-4 text-sm">
When Smart Suggestions and platform APIs are fully connected,
Autoaffi will notify you automatically when viral opportunities
arise in your niche.
</p>
<Link
href="/login/dashboard/network"
className="inline-block rounded-full bg-yellow-400 text-slate-900 font-semibold px-5 py-2 hover:brightness-110 transition"
>
Join Community Boost →
</Link>
</motion.div>
</div>
</main>
);
}