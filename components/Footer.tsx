"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Footer() {
return (
<footer className="bg-slate-950 border-t border-slate-800 py-10 text-slate-400 text-sm px-6 md:px-12">
<motion.div
initial={{ opacity: 0 }}
whileInView={{ opacity: 1 }}
transition={{ duration: 0.6 }}
className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4"
>
<p className="text-center md:text-left text-slate-500">
© {new Date().getFullYear()}{" "}
<span className="text-yellow-400 font-semibold">Autoaffi</span>. All rights reserved.
</p>

<div className="flex gap-6 text-sm">
<Link href="#pricing" className="hover:text-yellow-400 transition">
Pricing
</Link>
<Link href="#faq" className="hover:text-yellow-400 transition">
FAQ
</Link>
<Link href="/login" className="hover:text-yellow-400 transition">
Login
</Link>
</div>
</motion.div>
</footer>
);
}
