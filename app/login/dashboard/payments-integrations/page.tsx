"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOCK_INTEGRATIONS = [
{
name: "Stripe",
status: "Connected",
lastSync: "2025-11-09 12:45",
details: "Handles subscriptions, billing, and user payouts.",
paymentMethod: "Visa •••• 4242",
},
{
name: "MyLead",
status: "Connected",
lastSync: "2025-11-09 11:22",
details: "Tracks affiliate leads and conversions.",
paymentMethod: "Auto via Stripe Connect",
},
{
name: "CPAlead",
status: "Pending",
lastSync: "-",
details: "Pending API verification.",
paymentMethod: "Awaiting approval",
},
];

const MOCK_TRANSACTIONS = [
{
id: "txn_101",
date: "2025-11-08",
source: "Stripe",
type: "Subscription payment",
amount: "$19.00",
status: "Processed",
},
{
id: "txn_100",
date: "2025-11-03",
source: "MyLead",
type: "Affiliate commission",
amount: "$12.70",
status: "Pending payout",
},
{
id: "txn_099",
date: "2025-10-28",
source: "Stripe",
type: "Autoaffi subscription",
amount: "$19.00",
status: "Processed",
},
];

export default function PaymentsIntegrationsPage() {
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
Payments & Integrations
</h1>
<p className="max-w-2xl text-sm md:text-base text-slate-600">
Review connected payment systems, network integrations and transaction
activity. Autoaffi automatically syncs balances daily.
</p>
</motion.header>

{/* Integrations */}
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">Connected Systems</CardTitle>
</CardHeader>
<CardContent className="overflow-x-auto text-xs md:text-sm">
<table className="min-w-full text-left">
<thead>
<tr className="border-b border-slate-100 text-slate-500">
<th className="py-2 pr-4">Integration</th>
<th className="py-2 pr-4">Status</th>
<th className="py-2 pr-4">Payment Method</th>
<th className="py-2 pr-4">Last Sync</th>
<th className="py-2">Details</th>
</tr>
</thead>
<tbody>
{MOCK_INTEGRATIONS.map((i) => (
<tr key={i.name} className="border-b border-slate-50">
<td className="py-2 pr-4 font-semibold text-slate-800">{i.name}</td>
<td className="py-2 pr-4">
<span
className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
i.status === "Connected"
? "bg-emerald-50 text-emerald-700"
: i.status === "Pending"
? "bg-amber-50 text-amber-700"
: "bg-slate-100 text-slate-600"
}`}
>
{i.status}
</span>
</td>
<td className="py-2 pr-4 text-slate-700">{i.paymentMethod}</td>
<td className="py-2 pr-4 text-slate-600">{i.lastSync}</td>
<td className="py-2 text-slate-600">{i.details}</td>
</tr>
))}
</tbody>
</table>
</CardContent>
</Card>

{/* Transactions */}
<Card className="border-slate-200 shadow-sm">
<CardHeader>
<CardTitle className="text-base md:text-lg">
Latest Transactions (mock)
</CardTitle>
</CardHeader>
<CardContent className="overflow-x-auto text-xs md:text-sm">
<table className="min-w-full text-left">
<thead>
<tr className="border-b border-slate-100 text-slate-500">
<th className="py-2 pr-4">Date</th>
<th className="py-2 pr-4">Source</th>
<th className="py-2 pr-4">Type</th>
<th className="py-2 pr-4">Amount</th>
<th className="py-2">Status</th>
</tr>
</thead>
<tbody>
{MOCK_TRANSACTIONS.map((t) => (
<tr key={t.id} className="border-b border-slate-50">
<td className="py-2 pr-4 text-slate-600">{t.date}</td>
<td className="py-2 pr-4 font-semibold text-slate-800">{t.source}</td>
<td className="py-2 pr-4 text-slate-600">{t.type}</td>
<td className="py-2 pr-4 text-yellow-600 font-semibold">
{t.amount}
</td>
<td className="py-2 text-slate-600">
<span
className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
t.status === "Processed"
? "bg-emerald-50 text-emerald-700"
: "bg-amber-50 text-amber-700"
}`}
>
{t.status}
</span>
</td>
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