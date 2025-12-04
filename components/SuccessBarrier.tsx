"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function SuccessBarrier() {
const [postsPerWeek, setPostsPerWeek] = useState(3);
const transition = { duration: 0.8, ease: "easeInOut" as const };

// Enkel beräkning av "potentiell intäkt" baserat på inlägg/vecka
const estimatedEarnings = Math.round(
postsPerWeek * 37 + Math.pow(postsPerWeek, 1.4) * 5
);

return (
<section
id="success-barrier"
className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
>
<motion.h2
initial={{ opacity: 0, y: 30 }}
whileInView={{ opacity: 1, y: 0 }}
transition={transition}
className="text-4xl md:text-5xl font-extrabold text-center mb-6"
>
How to{" "}
<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
Succeed with Autoaffi
</span>
</motion.h2>

<p className="text-center text-slate-300 max-w-2xl mx-auto mb-16">
Adjust your posting activity and see how consistent engagement can boost
your weekly earnings.
</p>

<motion.div
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={transition}
className="max-w-3xl mx-auto bg-slate-900/70 rounded-3xl shadow-xl border border-slate-800 p-10"
>
<div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
<div className="w-full md:w-1/2">
<label className="text-slate-200 font-semibold mb-2 block text-center md:text-left">
Posts per week:{" "}
<span className="text-yellow-400">{postsPerWeek}</span>
</label>
<input
type="range"
min={0}
max={14}
value={postsPerWeek}
onChange={(e) => setPostsPerWeek(Number(e.target.value))}
className="w-full accent-yellow-500 cursor-pointer"
/>
</div>

<div className="text-center md:text-right">
<p className="text-slate-300 font-medium">
Estimated Weekly Earnings
</p>
<p className="text-4xl font-extrabold text-yellow-400">
${estimatedEarnings.toLocaleString()}
</p>
</div>
</div>

{/* Barometer */}
<div className="relative h-6 bg-slate-800 rounded-full overflow-hidden">
<motion.div
className="absolute left-0 top-0 h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full"
initial={{ width: 0 }}
animate={{ width: `${(postsPerWeek / 14) * 100}%` }}
transition={{ duration: 0.6, ease: "easeInOut" as const }}
/>
</div>

<div className="flex justify-between text-xs text-slate-500 mt-2">
<span>0 posts</span>
<span>7 posts</span>
<span>14 posts</span>
</div>

<p className="text-center text-slate-400 mt-10">
Consistency matters — the more high-quality posts Autoaffi helps you
create, the more affiliate opportunities you unlock.
</p>
</motion.div>
</section>
);
}