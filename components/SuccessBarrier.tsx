"use client";

import { motion } from "framer-motion";

export default function SuccessBarrier() {
  const transition = { duration: 0.8, ease: "easeInOut" as const };

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
        Increase Your Success with{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
          Autoaffi
        </span>
      </motion.h2>

      <p className="text-center text-slate-300 max-w-2xl mx-auto mb-12">
        Autoaffi increases your odds by building a repeatable system: consistency, tracking, winners, and daily guidance.
        Here’s what you do — and what results typically look like over time.
      </p>

      {/* ✅ Image (smaller + sharp) */}
      <motion.img
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={transition}
        src="/media/success-probability.png"
        alt="Increase success probability with Autoaffi"
        className="w-full max-w-3xl md:max-w-4xl mx-auto rounded-3xl shadow-xl border border-slate-800 bg-slate-900/40"
        loading="lazy"
      />

      {/* ✅ What’s required + timeline (no bar) */}
      <div className="max-w-4xl mx-auto mt-12 grid md:grid-cols-4 gap-4">
        {[
          {
            t: "Week 1",
            d: "Set up your niche, offers, tracking and daily routine (15–30 min/day).",
          },
          {
            t: "Weeks 2–3",
            d: "Post consistently + follow the daily focus. Start identifying what gets clicks.",
          },
          {
            t: "Weeks 4–6",
            d: "Optimize winners, improve hooks/captions, and tighten your link + lead flow.",
          },
          {
            t: "60–90 Days",
            d: "Scale what works: more output, stronger offers, and repeatable workflows.",
          },
        ].map((x, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            viewport={{ once: true, amount: 0.2 }}
            className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 mb-2">
              {x.t}
            </p>
            <p className="text-sm text-slate-200 leading-relaxed">{x.d}</p>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-slate-500 text-xs mt-10 max-w-3xl mx-auto">
        Results vary by niche, consistency, and offer quality — Autoaffi’s job is to remove friction, keep you consistent,
        and help you iterate faster.
      </p>
    </section>
  );
}