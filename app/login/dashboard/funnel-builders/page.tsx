"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FunnelBuildersPage() {
const [olspUrl, setOlspUrl] = useState("");
const [hbaUrl, setHbaUrl] = useState("");
const [clickFunnelsUrl, setClickFunnelsUrl] = useState("");
const [otherUrl, setOtherUrl] = useState("");
const [lockToFunnel, setLockToFunnel] = useState<boolean | null>(null);
const [saved, setSaved] = useState(false);

const handleSave = () => {
setSaved(true);
setTimeout(() => setSaved(false), 2000);
};

return (
<main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
<div className="mx-auto flex max-w-5xl flex-col gap-8">
{/* Header */}
<motion.header
initial={{ opacity: 0, y: 18 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-3"
>
<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
Funnel Builders
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Link your main funnel(s) below. Autoaffi can prioritize offers and
networks that match your funnel’s strategy — or keep them open for
all networks.
</p>
</motion.header>

{/* Funnel inputs */}
<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Your Funnels
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
OLSP funnel URL
</label>
<input
value={olspUrl}
onChange={(e) => setOlspUrl(e.target.value)}
placeholder="https://your-olsp-link..."
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>

<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
Home Business Academy funnel URL
</label>
<input
value={hbaUrl}
onChange={(e) => setHbaUrl(e.target.value)}
placeholder="https://your-hba-link..."
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>

<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
ClickFunnels funnel URL
</label>
<input
value={clickFunnelsUrl}
onChange={(e) => setClickFunnelsUrl(e.target.value)}
placeholder="https://your-clickfunnels-link..."
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>

<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
Other funnel URL
</label>
<input
value={otherUrl}
onChange={(e) => setOtherUrl(e.target.value)}
placeholder="Any other funnel link you want Autoaffi to recognize."
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>

{/* Yes / No lock choice */}
<div className="space-y-2 pt-4 border-t border-slate-200">
<label className="text-xs font-medium text-slate-700">
Lock content and offers to your funnel?
</label>
<div className="flex gap-3 mt-1">
<button
type="button"
onClick={() => setLockToFunnel(true)}
className={`px-4 py-1 rounded-full text-xs font-semibold transition ${
lockToFunnel === true
? "bg-green-600 text-white"
: "bg-slate-200 text-slate-700 hover:bg-slate-300"
}`}
>
Yes
</button>
<button
type="button"
onClick={() => setLockToFunnel(false)}
className={`px-4 py-1 rounded-full text-xs font-semibold transition ${
lockToFunnel === false
? "bg-red-600 text-white"
: "bg-slate-200 text-slate-700 hover:bg-slate-300"
}`}
>
No
</button>
</div>

{lockToFunnel === true && (
<p className="text-xs text-slate-500 mt-2">
Your content and offers will be locked to your primary
funnel. Networks like ClickBank and CPAlead will be disabled,
but MLSP remains available for Elite users.
</p>
)}
{lockToFunnel === false && (
<p className="text-xs text-slate-500 mt-2">
Autoaffi will keep all networks open, letting you combine
your funnel with ClickBank, CPAlead and MyLead offers.
</p>
)}
</div>

<Button
onClick={handleSave}
className="mt-4 rounded-full bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
>
Save funnel preferences (mock)
</Button>
{saved && (
<p className="text-xs text-emerald-700 mt-1">
Preferences saved locally (mock). API integration coming soon.
</p>
)}
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}