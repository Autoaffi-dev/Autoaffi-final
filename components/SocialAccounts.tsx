"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

type Platform = {
name: string;
connected: boolean;
url?: string;
};

export default function SocialAccounts() {
const [platforms, setPlatforms] = useState<Platform[]>([
{ name: "Facebook", connected: true, url: "https://facebook.com/autoaffi" },
{ name: "Instagram", connected: false },
{ name: "LinkedIn", connected: true, url: "https://linkedin.com/in/autoaffi" },
{ name: "TikTok", connected: false },
{ name: "YouTube", connected: true, url: "https://youtube.com/@autoaffi" },
]);

const toggleConnection = (name: string) => {
setPlatforms((prev) =>
prev.map((p) =>
p.name === name ? { ...p, connected: !p.connected } : p
)
);
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
Social Accounts
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Manage and connect your social media accounts to Autoaffi.
Connected profiles allow analytics, scheduling, and personalized AI insights.
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
Connected Platforms
</CardTitle>
</CardHeader>
<CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
{platforms.map((platform) => (
<motion.div
key={platform.name}
whileHover={{ scale: 1.03 }}
transition={{ type: "spring", stiffness: 300 }}
className={`rounded-xl border p-4 ${
platform.connected
? "border-emerald-400 bg-emerald-50"
: "border-slate-200 bg-white"
} shadow-sm flex flex-col justify-between`}
>
<div className="flex items-center justify-between mb-2">
<h3 className="text-sm font-semibold text-slate-800">
{platform.name}
</h3>
{platform.connected ? (
<CheckCircle className="text-emerald-600 w-4 h-4" />
) : (
<XCircle className="text-slate-400 w-4 h-4" />
)}
</div>

{platform.connected && platform.url ? (
<a
href={platform.url}
target="_blank"
className="text-xs text-amber-600 hover:text-amber-700"
>
{platform.url}
</a>
) : (
<p className="text-xs text-slate-500 mb-2">
Not connected yet.
</p>
)}

<Button
size="sm"
onClick={() => toggleConnection(platform.name)}
className={`mt-2 w-full rounded-full text-xs font-semibold ${
platform.connected
? "bg-slate-900 text-white hover:bg-slate-800"
: "bg-yellow-500 text-black hover:bg-yellow-400"
}`}
>
{platform.connected ? "Disconnect" : "Connect"}
</Button>
</motion.div>
))}
</CardContent>
</Card>
</motion.div>
</div>
</main>
);
}