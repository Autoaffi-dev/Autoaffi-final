"use client";

import { motion } from "framer-motion";

export default function FAQ() {
  const faqs = [
    {
      q: "What is Autoaffi?",
      a: "Autoaffi is an all-in-one system for affiliate creators — built to remove friction, create consistency, and help you scale. You can discover commissionable offers, generate content workflows, track links cleanly, and follow a daily focus that keeps you moving forward.",
    },
    {
      q: "Do I need experience to start?",
      a: "No. Autoaffi is built for beginners and busy creators. If you can commit 15–30 minutes per day, Autoaffi helps you build a repeatable routine with clear next steps, better structure, and less guessing.",
    },
    {
      q: "How does Autoaffi help me earn more?",
      a: "Most people fail because they lack consistency, tracking, and a repeatable system. Autoaffi focuses on (1) offer discovery, (2) structured link + tracking, (3) faster content output, (4) lead workflows, and (5) daily guidance — so you can iterate winners faster.",
    },
    {
      q: "Is affiliate marketing a scam?",
      a: "Affiliate marketing itself is legitimate: you recommend a product and earn commission when someone buys through your link. It becomes “scammy” when people overpromise, hide disclosures, or spam links. Autoaffi is built around transparency, value-first content, and long-term systems — not hype.",
    },
    {
      q: "How quickly can I expect results?",
      a: "Results vary by niche and effort. Typically: Week 1 is setup + routine, Weeks 2–3 are consistent posting, Weeks 4–6 are optimization, and 60–90 days is where systems start compounding. Autoaffi is designed to shorten the trial-and-error phase and keep you consistent.",
    },
    {
      q: "Do you support online + offline marketing (QR / merchandise)?",
      a: "Yes. Autoaffi supports QR-based flows for both online and offline growth. That includes merchandise-ready QR assets so you can drive traffic, capture leads, and track performance in a structured way.",
    },
    {
      q: "Can I promote my own funnels or services?",
      a: "Yes. You can use your own links and offers. Autoaffi is designed to be your system — whether you're promoting affiliate products, recurring tools, or your own funnel flow.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. You can cancel at any time. Your access remains active until the end of your billing period, and you can request data deletion/export using the options in our Privacy pages.",
    },
  ];

  return (
    <section
      id="faq"
      className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-4xl md:text-5xl font-extrabold text-center mb-8"
      >
        Frequently Asked{" "}
        <span className="text-yellow-400 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600">
          Questions
        </span>
      </motion.h2>

      <div className="max-w-4xl mx-auto space-y-6">
        {faqs.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6"
          >
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">
              {f.q}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">{f.a}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}