"use client";

import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const tips = [
  {
    title: "Be consistent",
    desc: "Post twice a day on all platforms — consistency builds trust and visibility.",
  },
  {
    title: "Use faceless or personal accounts",
    desc: "If you prefer privacy, create a faceless account and let your content speak.",
  },
  {
    title: "Apply the 4-Give Principle",
    desc: "On Facebook, post 4 value-driven or motivational posts for every 1 affiliate offer.",
  },
  {
    title: "Leverage smart tools",
    desc: "Use Canva for visuals, CapCut for editing, and AI captions to maximize your reach.",
  },
  {
    title: "Stay authentic",
    desc: "Your audience connects to real voices — automation helps, but authenticity converts.",
  },
];

export default function HowToSucceed() {
  return (
    <section
      id="how-to-succeed"
      className="relative py-24 px-6 md:px-12 bg-gradient-to-b from-white to-gray-50 text-center"
    >
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6"
      >
        How to <span className="text-gradient">Succeed</span> with Autoaffi
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: EASE }}
        className="text-gray-600 max-w-2xl mx-auto mb-12"
      >
        These are the five essential habits of successful affiliate creators who
        grow consistently using Autoaffi’s automation tools.
      </motion.p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
        {tips.map((tip, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15, duration: 0.8, ease: EASE }}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle className="text-yellow-500 w-6 h-6 flex-shrink-0 mt-1" />
              <h3 className="text-lg font-semibold text-gray-900">{tip.title}</h3>
            </div>
            <p className="text-gray-600">{tip.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}