"use client";

import { motion } from "framer-motion";

export default function HowItWorks() {
  const steps = [
    {
      title: "1) Pick a niche + goal",
      desc: "Define what you want: extra income, recurring focus, or high-ticket wins.",
    },
    {
      title: "2) Choose offers inside Autoaffi",
      desc: "Search offers, save winners, and keep your system clean and trackable.",
    },
    {
      title: "3) Create content faster",
      desc: "Use structured hooks/captions/reels workflows to publish consistently.",
    },
    {
      title: "4) Grow with leads + QR",
      desc: "Capture leads online/offline, follow up, and scale what proves results.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-extrabold text-center mb-10"
        >
          How{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
            Autoaffi
          </span>{" "}
          Works
        </motion.h2>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/30"
            >
              <h3 className="font-semibold text-yellow-400 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-sm mt-10 max-w-3xl mx-auto">
          This is not about luck. It’s about running a simple system long enough for the data to show what wins.
        </p>
      </div>
    </section>
  );
}