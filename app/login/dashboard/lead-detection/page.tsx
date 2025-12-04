"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LeadDetectionPage() {
const [leads, setLeads] = useState([
{ id: 1, name: "John Smith", platform: "Facebook", intent: "Asked about affiliate income" },
{ id: 2, name: "CreatorJane", platform: "TikTok", intent: "Commented 'I need this!'" },
]);

const [scanning, setScanning] = useState(false);

const handleScan = () => {
setScanning(true);
setTimeout(() => setScanning(false), 2000);
};

return (
<main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6 }}
className="mx-auto max-w-5xl"
>
<h1 className="text-3xl md:text-4xl font-extrabold mb-4">Lead Detection</h1>
<p className="text-slate-600 mb-8 text-sm">
Detects users (inside or outside your network) who comment or engage with “make money online”,
“affiliate marketing”, or related terms.
</p>

<Button
onClick={handleScan}
className="mb-6 bg-slate-900 text-white hover:bg-slate-800 rounded-full text-sm px-5 py-2"
>
{scanning ? "Scanning..." : "Scan for New Leads"}
</Button>

<div className="grid gap-4 md:grid-cols-2">
{leads.map((lead) => (
<Card key={lead.id} className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base">{lead.name}</CardTitle>
</CardHeader>
<CardContent className="text-sm text-slate-700">
<p>Platform: {lead.platform}</p>
<p>Activity: {lead.intent}</p>
</CardContent>
</Card>
))}
</div>
</motion.div>
</main>
);
}