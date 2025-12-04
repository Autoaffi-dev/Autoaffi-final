"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdsPage() {
const [connected, setConnected] = useState(false);
const [campaignName, setCampaignName] = useState("");
const [budget, setBudget] = useState(10);

const handleConnect = () => {
// Placeholder – här kommer Metricool / andra API:n senare
setConnected(true);
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
Ads & Scheduling
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Connect your scheduling tool (Metricool, etc.) and manage campaigns directly
from Autoaffi. This is the control room for paid traffic and auto-posting.
</p>
</motion.header>

{/* Connect scheduling tool */}
<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Connect scheduling & analytics
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<p className="text-slate-600">
We recommend connecting a tool like <strong>Metricool</strong> for advanced
scheduling, analytics and ad management. Autoaffi will talk to it via API,
so you can stay inside one dashboard.
</p>
<Button
onClick={handleConnect}
className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-sm font-semibold text-slate-900 shadow-md hover:brightness-110"
>
{connected ? "Connected (mock)" : "Connect scheduling tool (mock)"}
</Button>
{connected && (
<p className="text-xs text-emerald-700">
Connected in mock mode – later this will open the real OAuth flow.
</p>
)}
</CardContent>
</Card>
</motion.div>

{/* Simple campaign mock */}
<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
>
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Quick Campaign Planner (preview)
</CardTitle>
</CardHeader>
<CardContent className="space-y-4 text-sm">
<div className="grid gap-4 md:grid-cols-2">
<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
Campaign name
</label>
<input
value={campaignName}
onChange={(e) => setCampaignName(e.target.value)}
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
placeholder="e.g. TikTok winter promo"
/>
</div>

<div className="space-y-2">
<label className="text-xs font-medium text-slate-700">
Daily budget (USD)
</label>
<input
type="number"
value={budget}
min={1}
onChange={(e) => setBudget(Number(e.target.value))}
className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>
</div>

<p className="text-xs text-slate-500">
Later this form will push campaigns to Meta / TikTok / Google via their
APIs. For now it’s just a sandbox to get the UX right.
</p>

<Button className="rounded-full bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800">
Save draft (mock)
</Button>
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}