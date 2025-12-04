"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function HooksGenerator() {
  const [niche, setNiche] = useState("Affiliate Marketing");
  const [hooks, setHooks] = useState<string[]>([]);

  const examples = [
    "Stop scrolling – your next passive income stream starts here.",
    "Turn your content into commission – automatically.",
    "What if your posts paid you while you sleep?",
    "Grow your traffic, not your workload.",
  ];

  const generateHooks = () => {
    const shuffled = [...examples].sort(() => 0.5 - Math.random());
    setHooks(shuffled.slice(0, 3));
  };

  return (
    <section className="py-20 bg-gradient-to-b from-white to-slate-50 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-bold text-slate-800 mb-4"
      >
        Create Viral Hooks ⚡
      </motion.h2>
      <p className="text-slate-500 mb-6">
        Instantly generate attention-grabbing openings for your affiliate posts.
      </p>

      <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-8">
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2"
        >
          <option>Affiliate Marketing</option>
          <option>Finance</option>
          <option>Fitness</option>
          <option>Gaming</option>
          <option>Motivation</option>
        </select>

        <button
          onClick={generateHooks}
          className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:scale-105 transition-transform"
        >
          Generate Hook
        </button>
      </div>

      <div className="space-y-3 max-w-lg mx-auto">
        {hooks.map((hook, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white shadow p-4 rounded-xl text-slate-700"
          >
            💬 {hook}
          </motion.div>
        ))}
      </div>
    </section>
  );
}