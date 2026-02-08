"use client";

import { motion } from "framer-motion";

export default function AffiliateExplained() {
  return (
    <section
      id="affiliate-explained"
      className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
    >
      <div className="max-w-5xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-extrabold mb-6"
        >
          What is{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
            Affiliate Marketing
          </span>{" "}
          — and why do some people call it a scam?
        </motion.h2>

        <p className="max-w-3xl mx-auto text-slate-300 leading-relaxed">
          Affiliate marketing is simple: you recommend a product, and you earn a commission when someone buys through your link.
          It becomes “scammy” when people push unrealistic promises, hide disclosures, or spam links without real value.
          Autoaffi is built around the opposite: transparency, consistency, and long-term recurring programs.
        </p>

        <div className="mt-10 grid md:grid-cols-3 gap-6 text-left">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
            <h3 className="font-semibold text-yellow-400 mb-2">Why people doubt it</h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Overpromises (“easy money”).</li>
              <li>• No disclosure / misleading content.</li>
              <li>• Spam DMs + link dumping.</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
            <h3 className="font-semibold text-yellow-400 mb-2">What makes it legitimate</h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Honest value-first content.</li>
              <li>• Clear affiliate disclosure.</li>
              <li>• Consistency + testing winners.</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6">
            <h3 className="font-semibold text-yellow-400 mb-2">Why it’s growing</h3>
            <p className="text-sm text-slate-300">
              The creator economy keeps pushing affiliate as a performance-driven channel, and business media
              has highlighted how brands move toward affiliate-style models.
              {" "}
              <a
                href="https://www.forbes.com/councils/forbescommunicationscouncil/2025/03/25/why-and-how-brands-are-swapping-mlm-for-affiliate-marketing/"
                target="_blank"
                className="text-amber-300 underline underline-offset-2 hover:text-yellow-300"
              >
                Read the Forbes perspective
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}