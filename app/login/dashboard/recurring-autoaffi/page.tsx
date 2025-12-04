"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RecurringAutoaffi() {
const [referral] = useState("https://autoaffi.com/ref/linus123");
const [stats] = useState({
totalReferrals: 28,
activeUsers: 21,
monthlyEarnings: 294.5,
totalEarned: 1332.75,
});

return (
<motion.div
className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white p-8"
initial={{ opacity: 0, y: 40 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, ease: "easeInOut" }}
>
<h1 className="text-4xl font-bold mb-8 text-center text-yellow-400">Autoaffi Recurring Program</h1>

<div className="max-w-4xl mx-auto space-y-8">
<Card className="bg-zinc-900 border border-yellow-700 shadow-xl">
<CardHeader>
<h2 className="text-2xl font-semibold text-yellow-300">Your Referral Link</h2>
</CardHeader>
<CardContent>
<div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
<span className="truncate">{referral}</span>
<Button
className="bg-yellow-500 text-black hover:bg-yellow-400 transition-all"
onClick={() => navigator.clipboard.writeText(referral)}
>
Copy
</Button>
</div>
</CardContent>
</Card>

<Card className="bg-zinc-900 border border-zinc-800 shadow-lg">
<CardHeader>
<h2 className="text-2xl font-semibold text-yellow-300">Earnings Overview</h2>
</CardHeader>
<CardContent className="space-y-3 text-lg">
<p>Total Referrals: <span className="text-yellow-400">{stats.totalReferrals}</span></p>
<p>Active Users: <span className="text-yellow-400">{stats.activeUsers}</span></p>
<p>Monthly Earnings: <span className="text-green-400">${stats.monthlyEarnings}</span></p>
<p>Total Earned: <span className="text-green-400">${stats.totalEarned}</span></p>
</CardContent>
</Card>
</div>
</motion.div>
);
}