"use client";

import { motion } from "framer-motion";

export default function WhyChoose() {
  const transition = { duration: 0.8, ease: ["easeInOut" as const] };

  const features = [
    {
      title: "Offer & Product Discovery Engine",
      desc: "Search and discover commissionable offers inside Autoaffi — so you don’t waste time jumping between multiple dashboards.",
    },
    {
      title: "Automatic Link & Tracking Structure",
      desc: "We keep your tracking clean and structured — so you can measure what works, repeat winners, and scale with confidence.",
    },
    {
      title: "Recurring Income Focus",
      desc: "We prioritize recurring programs when available — so you build long-term income instead of restarting from zero every month.",
    },
    {
      title: "High-Ticket Opportunities (All Plans)",
      desc: "We highlight higher-value offers when they fit — so your effort can create meaningful commission even with a smaller audience.",
    },
    {
      title: "Growth Engine (Lead Finder)",
      desc: "Find real leads and businesses to reach out to — with a simple workflow for outreach, follow-ups, and pipeline tracking.",
    },
    {
      title: "Reels & Content Generator",
      desc: "Generate short-form content faster with structured scripts, hooks, captions, and creator-ready output workflows.",
    },
    {
      title: "QR Marketing (Online + Offline)",
      desc: "Use QR flows for online + offline growth — including merchandise-ready QR assets so you can capture leads anywhere.",
    },
    {
      title: "AI Coach + Daily Focus",
      desc: "A simple coach that tells you what to do next — so you always know today’s priority instead of guessing.",
    },
  ];

  return (
    <section
      id="why-choose"
      className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
    >
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={transition}
        className="text-4xl md:text-5xl font-extrabold text-center mb-6"
      >
        Why Choose{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
          Autoaffi
        </span>
      </motion.h2>

      <p className="text-center text-slate-300 max-w-2xl mx-auto mb-16">
        Autoaffi is built to remove friction and create consistency — the two things most affiliates struggle with.
        No hype. Just a real system you can run daily.
      </p>

      <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8, ease: ["easeInOut"] }}
            className="flex items-start space-x-4"
          >
            <div className="text-yellow-500 text-2xl mt-1">⚡</div>
            <div>
              <h3 className="text-xl font-bold mb-1 text-white">{f.title}</h3>
              <p className="text-slate-300">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
