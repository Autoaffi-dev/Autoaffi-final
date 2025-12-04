"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LearningHubPage() {
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
Learning Hub
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
This is where Autoaffi will coach your users with playbooks, checklists,
swipe files and AI-guided prompts – so they actually succeed, not just log in.
</p>
</motion.header>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="grid gap-6 md:grid-cols-3"
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-sm md:text-base">
Launch Playbook
</CardTitle>
</CardHeader>
<CardContent className="space-y-2 text-xs md:text-sm text-slate-600">
<p>
Step-by-step: from zero to first affiliate sale in 30 days using
Autoaffi, MyLead and one main social platform.
</p>
<p className="text-[11px] text-slate-500">
Coming soon – we’ll wire this to structured modules.
</p>
</CardContent>
</Card>

<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-sm md:text-base">
Content Library
</CardTitle>
</CardHeader>
<CardContent className="space-y-2 text-xs md:text-sm text-slate-600">
<p>
Hooks, captions and content frameworks organized by niche, platform and
offer type.
</p>
<p className="text-[11px] text-slate-500">
Will later connect to the Content Optimizer and your best-performing posts.
</p>
</CardContent>
</Card>

<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-sm md:text-base">
AI Coaching Sessions
</CardTitle>
</CardHeader>
<CardContent className="space-y-2 text-xs md:text-sm text-slate-600">
<p>
Chat-like guidance: “What should I post today?”, “How do I warm up a new
account?”, “How do I promote recurring offers ethically?”.
</p>
<p className="text-[11px] text-slate-500">
This is where we’ll plug in structured prompts and templates.
</p>
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}
