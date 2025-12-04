"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOCK_PAYOUTS = [
{ date: "2025-11-05", type: "Affiliate commission", amount: "$88.40", status: "Paid" },
{ date: "2025-10-28", type: "Autoaffi recurring", amount: "$132.00", status: "Paid" },
];

const MOCK_INCOMING = [
{ date: "2025-11-07", type: "Stripe payment received", amount: "$19.00", status: "Received" },
{ date: "2025-11-03", type: "New subscriber payment", amount: "$29.00", status: "Received" },
];

export default function PayoutsPage() {
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
Payouts Overview
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
View all incoming payments and payouts from Autoaffi. This includes both
your affiliate commissions and user payments.
</p>
</motion.header>

{/* Incoming */}
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">Incoming Payments</CardTitle>
</CardHeader>
<CardContent className="overflow-x-auto text-xs md:text-sm">
<table className="min-w-full text-left">
<thead>
<tr className="border-b border-slate-100 text-slate-500">
<th className="py-2 pr-4">Date</th>
<th className="py-2 pr-4">Type</th>
<th className="py-2 pr-4">Amount</th>
<th className="py-2">Status</th>
</tr>
</thead>
<tbody>
{MOCK_INCOMING.map((t) => (
<tr key={t.date} className="border-b border-slate-50">
<td className="py-2 pr-4 text-slate-600">{t.date}</td>
<td className="py-2 pr-4">{t.type}</td>
<td className="py-2 pr-4 text-emerald-600 font-semibold">
{t.amount}
</td>
<td className="py-2 text-emerald-700">{t.status}</td>
</tr>
))}
</tbody>
</table>
</CardContent>
</Card>

{/* Payouts */}
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">Outgoing Payouts</CardTitle>
</CardHeader>
<CardContent className="overflow-x-auto text-xs md:text-sm">
<table className="min-w-full text-left">
<thead>
<tr className="border-b border-slate-100 text-slate-500">
<th className="py-2 pr-4">Date</th>
<th className="py-2 pr-4">Type</th>
<th className="py-2 pr-4">Amount</th>
<th className="py-2">Status</th>
</tr>
</thead>
<tbody>
{MOCK_PAYOUTS.map((t) => (
<tr key={t.date} className="border-b border-slate-50">
<td className="py-2 pr-4 text-slate-600">{t.date}</td>
<td className="py-2 pr-4">{t.type}</td>
<td className="py-2 pr-4 text-yellow-600 font-semibold">
{t.amount}
</td>
<td className="py-2 text-emerald-700">{t.status}</td>
</tr>
))}
</tbody>
</table>
</CardContent>
</Card>
</div>
</main>
);
}