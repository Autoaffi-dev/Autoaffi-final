"use client";

import { motion } from "framer-motion";

export default function FAQ() {
const faqs = [
{
q: "What is Autoaffi?",
a: "Autoaffi is your all-in-one automation platform for affiliate marketing — connecting offers, AI tools, and recurring income streams in one dashboard.",
},
{
q: "Can I promote my own funnels or services?",
a: "Yes! Funnel Builders can link your personal funnel URLs and lock suggestions to your own offers.",
},
{
q: "How does recurring income work?",
a: "You earn a recurring percentage (10–50%) from all referred active users, plus optional commissions from recurring AI tools you promote.",
},
{
q: "Which affiliate networks integrate with Autoaffi?",
a: "MyLead, CPAlead, MLGS, ClickBank, and Digistore24 are supported — with more integrations coming soon.",
},
{
q: "Is Autoaffi beginner-friendly?",
a: "Absolutely. Basic plan includes community boost, viral trends, and lead detection — so you can start even without prior experience.",
},
];

return (
<section
id="faq"
className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
>
<motion.h2
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6 }}
viewport={{ once: true }}
className="text-4xl md:text-5xl font-extrabold text-center mb-8"
>
Frequently Asked{" "}
<span className="text-yellow-400 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600">
Questions
</span>
</motion.h2>

<div className="max-w-4xl mx-auto space-y-6">
{faqs.map((f, i) => (
<motion.div
key={i}
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ delay: i * 0.1, duration: 0.6 }}
viewport={{ once: true }}
className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6"
>
<h3 className="text-lg font-semibold text-yellow-400 mb-2">{f.q}</h3>
<p className="text-slate-300 text-sm leading-relaxed">{f.a}</p>
</motion.div>
))}
</div>
</section>
);
}