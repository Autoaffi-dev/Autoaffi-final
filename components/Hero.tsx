"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
return (
<section className="relative flex items-center justify-center min-h-screen overflow-hidden bg-black text-white">
{/* Bakgrundsvideo */}
<video
src="/media/hero.mp4"
autoPlay
loop
muted
playsInline
className="absolute inset-0 w-full h-full object-cover brightness-75"
/>

{/* Överlägg för kontrast */}
<div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

{/* Innehåll */}
<div className="relative z-10 max-w-4xl px-6 text-center">
<motion.h1
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8, ease: "easeOut" }}
className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6"
>
Turn{" "}
<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
Autoaffi
</span>{" "}
into your always-on affiliate engine.
</motion.h1>

<motion.p
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.15, duration: 0.7 }}
className="text-base md:text-lg text-slate-200 mb-8"
>
Connect your affiliate links, AI tools and social platforms in one
place. Autoaffi helps you grow recurring income while you keep full
control over your brand and content.
</motion.p>

<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.3, duration: 0.7 }}
className="flex flex-wrap justify-center gap-4"
>
<Link
href="/login"
className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_40px_rgba(250,204,21,0.45)] hover:bg-yellow-300 transition"
>
Get Started
</Link>

<Link
href="/login/dashboard"
className="inline-flex items-center justify-center rounded-full border border-slate-300/30 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition"
>
View Dashboard Demo ↗
</Link>
</motion.div>

<motion.p
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.45, duration: 0.7 }}
className="mt-8 text-[11px] text-slate-400"
>
No auto-DMs. No spam. Just structured automation around your content.
</motion.p>
</div>
</section>
);
}