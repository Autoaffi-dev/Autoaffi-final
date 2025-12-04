"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Pricing() {
return (
<section
id="pricing"
className="relative py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
>
<motion.h2
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ duration: 0.6 }}
className="text-center text-4xl md:text-5xl font-extrabold mb-8"
>
Choose Your Plan
</motion.h2>

<p className="text-center text-slate-400 mb-14 max-w-2xl mx-auto">
Automation, recurring income and AI-powered growth — built for every creator level.
</p>

<div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
{/* BASIC */}
<motion.div
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ duration: 0.6 }}
className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30 p-8 flex flex-col justify-between"
>
<div>
<h3 className="text-2xl font-bold mb-2 text-yellow-400">Basic</h3>
<p className="text-4xl font-extrabold mb-6">$7/mo</p>
<ul className="space-y-3 text-slate-300 text-sm mb-8">
<li>✔ MyLead affiliate network access</li>
<li>✔ Connect social accounts (Facebook, TikTok, Instagram, YouTube)</li>
<li>✔ Community Boost access</li>
<li>✔ Viral Heads-Up insights</li>
<li>✔ Lead Detection (basic tier)</li>
<li>✔ Access to ClickBank & digital-product marketplace</li>
<li>✔ Autoaffi Recurring Income (10 % tier)</li>
<li>✔ AI Tools demo (limited)</li>
<li>✔ Manual campaign posting & tracking</li>
<li>✔ Email support</li>
</ul>
</div>
<Link
href="/login"
className="w-full text-center rounded-full bg-slate-800 hover:bg-slate-700 text-white py-2 font-semibold transition-all"
>
Get Started
</Link>
</motion.div>

{/* PRO */}
<motion.div
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ delay: 0.1, duration: 0.6 }}
className="rounded-3xl border border-yellow-500 bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 shadow-xl shadow-yellow-900/30 p-8 flex flex-col justify-between"
>
<div>
<h3 className="text-2xl font-bold mb-2 text-yellow-400">Pro</h3>
<p className="text-4xl font-extrabold mb-6">$19/mo</p>
<ul className="space-y-3 text-slate-300 text-sm mb-8">
<li>✔ Everything in Basic</li>
<li>✔ CPAlead + MLGS (2×/week sync)</li>
<li>✔ Autoaffi Recurring Income (25 % tier)</li>
<li>✔ Full AI Tools (caption, hook, optimizer)</li>
<li>✔ ClickBank full access & product recommendations</li>
<li>✔ Smart Suggestions unlocked</li>
<li>✔ Schedule & auto-post content</li>
<li>✔ Multi-network analytics</li>
</ul>
</div>
<Link
href="/login"
className="w-full text-center rounded-full bg-yellow-500 text-slate-900 font-semibold py-2 hover:bg-yellow-400 transition-all"
>
Upgrade to Pro
</Link>
</motion.div>

{/* ELITE */}
<motion.div
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ delay: 0.2, duration: 0.6 }}
className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30 p-8 flex flex-col justify-between"
>
<div>
<h3 className="text-2xl font-bold mb-2 text-yellow-400">Elite</h3>
<p className="text-4xl font-extrabold mb-6">$39/mo</p>
<ul className="space-y-3 text-slate-300 text-sm mb-8">
<li>✔ Everything in Pro</li>
<li>✔ Full MyLead + CPAlead + MLGS integrations</li>
<li>✔ Autoaffi Recurring Income (50 % lifetime tier)</li>
<li>✔ Funnel-locking for exclusive campaigns</li>
<li>✔ Priority access to AI monetization tools</li>
<li>✔ ClickBank + Digistore24 API sync</li>
<li>✔ Advanced automation & data locking</li>
<li>✔ VIP support & strategy sessions</li>
</ul>
</div>
<Link
href="/login"
className="w-full text-center rounded-full bg-slate-800 hover:bg-slate-700 text-white py-2 font-semibold transition-all"
>
Go Elite
</Link>
</motion.div>
</div>
</section>
);
}