"use client";

import { motion, Transition } from "framer-motion";

export default function AboutAutoaffi() {
const transition: Transition = { duration: 0.8, ease: "easeInOut" };

return (
<section
id="about"
className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
>
<div className="max-w-5xl mx-auto text-center">
<motion.h2
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={transition}
className="text-4xl md:text-5xl font-extrabold mb-6 text-center"
>
The Story Behind{" "}
<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
Autoaffi
</span>
</motion.h2>

<motion.p
initial={{ opacity: 0 }}
whileInView={{ opacity: 1 }}
transition={{ delay: 0.2, ...transition }}
className="max-w-3xl mx-auto text-lg text-slate-300 leading-relaxed mb-12"
>
Autoaffi was created to simplify affiliate marketing. Many creators
struggle with consistency and tech barriers — so we built a platform
that automates posting, optimizes content, and turns daily actions
into measurable results.
</motion.p>

<motion.img
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ delay: 0.3, ...transition }}
src="/media/network-dashboard.jpg"
alt="Autoaffi dashboard"
className="rounded-3xl shadow-lg mx-auto w-full max-w-4xl"
/>
</div>
</section>
);
}