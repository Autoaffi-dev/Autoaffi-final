"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLANS = [
{
name: "Basic",
price: "$9 / month",
tag: "Good for getting started",
features: [
"Hooks Generator",
"Create affiliate links matched to your niche",
"MyLead integration",
"Manual posting only",
"Email support",
],
},
{
name: "Pro",
price: "$19 / month",
tag: "Most popular",
features: [
"Hooks + Captions Generator",
"Create affiliate links matched to your niche",
"MyLead + CPAlead integration",
"Up to 20 active campaigns",
"Ad performance dashboard",
"Email support",
],
},
{
name: "Elite",
price: "$39 / month",
tag: "Full automation unlocked",
features: [
"Hooks + Captions + Content Generator",
"Create affiliate links matched to your niche",
"All integrations (MyLead, CPAlead, MLGS)",
"Scheduling & auto-posting",
"Advanced AI optimization suggestions",
"Ad performance dashboard",
"Priority email support",
],
},
] as const;

const CURRENT_PLAN = "Pro";

export default function DashboardPricingPage() {
return (
<main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-6 py-10 md:px-12">
<div className="mx-auto flex max-w-6xl flex-col gap-8">
<motion.header
initial={{ opacity: 0, y: 18 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="space-y-3"
>
<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
Your plan & upgrades
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
See what’s included in your current plan and what you unlock by upgrading.
Billing is handled by Stripe once we connect the live integration.
</p>
</motion.header>

<motion.div
initial={{ opacity: 0, y: 14 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45 }}
className="grid gap-6 md:grid-cols-3"
>
{PLANS.map((plan) => {
const isCurrent = plan.name === CURRENT_PLAN;

return (
<Card
key={plan.name}
className={`flex flex-col border ${
isCurrent
? "border-yellow-400 shadow-lg shadow-yellow-100"
: "border-slate-200 shadow-sm"
}`}
>
<CardHeader className="pb-3">
<CardTitle className="flex items-center justify-between text-lg">
<span>{plan.name}</span>
{isCurrent && (
<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
Current plan
</span>
)}
</CardTitle>
<p className="mt-1 text-sm text-slate-500">{plan.tag}</p>
</CardHeader>
<CardContent className="flex flex-1 flex-col justify-between space-y-4">
<p className="text-2xl font-extrabold text-yellow-500">
{plan.price}
</p>
<ul className="space-y-2 text-sm text-slate-700">
{plan.features.map((f) => (
<li key={f} className="flex gap-2">
<span className="mt-1 text-yellow-500">✓</span>
<span>{f}</span>
</li>
))}
</ul>
<div className="pt-4">
{isCurrent ? (
<Button
disabled
className="w-full cursor-default rounded-full bg-slate-100 text-xs font-semibold text-slate-500"
>
This is your current plan
</Button>
) : (
<Button className="w-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-xs font-semibold text-slate-900 shadow-md hover:brightness-110">
Upgrade to {plan.name}
</Button>
)}
</div>
</CardContent>
</Card>
);
})}
</motion.div>
</div>
</main>
);
}
