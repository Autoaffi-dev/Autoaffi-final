"use client";

import { motion, Transition } from "framer-motion";

export default function Testimonials() {
const transition: Transition = { duration: 0.8, ease: "easeInOut" };

const testimonials = [
{
name: "Emily J.",
role: "Affiliate Marketer",
quote:
"Autoaffi changed how I manage campaigns. I save hours every week and my clicks doubled!",
},
{
name: "Ryan P.",
role: "Content Creator",
quote:
"The automation tools are gold. I can focus on creative work while Autoaffi handles the rest.",
},
{
name: "Sophia K.",
role: "Digital Strategist",
quote:
"Success Barrier helped me visualize my progress — seeing growth in numbers is so motivating.",
},
];

return (
<section
id="testimonials"
className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-center text-white px-6 md:px-12"
>
<motion.h2
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
transition={transition}
className="text-4xl md:text-5xl font-extrabold mb-12"
>
What{" "}
<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
Affiliates
</span>{" "}
Say
</motion.h2>

<div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
{testimonials.map((t, i) => (
<motion.div
key={i}
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ delay: i * 0.15, ...transition }}
className="p-8 bg-slate-900/70 rounded-3xl border border-slate-800 shadow-[0_18px_50px_rgba(0,0,0,0.6)] hover:border-yellow-400/60 hover:bg-slate-900/90 transition-all duration-500"
>
<p className="text-slate-300 italic mb-4">“{t.quote}”</p>
<h4 className="text-lg font-bold text-yellow-400">{t.name}</h4>
<p className="text-sm text-slate-400">{t.role}</p>
</motion.div>
))}
</div>
</section>
);
}