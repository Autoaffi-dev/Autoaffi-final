"use client";

import { motion } from "framer-motion";

const transition = { duration: 0.8 };

export default function AboutAutoaffi() {
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
          viewport={{ once: true, amount: 0.2 }}
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
          transition={{ delay: 0.15, ...transition }}
          viewport={{ once: true, amount: 0.2 }}
          className="max-w-3xl mx-auto text-lg text-slate-300 leading-relaxed mb-10"
        >
          Autoaffi was built for one reason: most creators never fail because they lack talent — they fail
          because the system is messy. Too many links, too many tools, no structure, no routine, and no
          feedback loop. That’s where consistency dies.
          <br />
          <br />
          Autoaffi gives you a clean, repeatable workflow: find offers, generate content, publish with a plan,
          capture leads, and improve week by week. You stay in control of your brand — we simply remove the
          friction and keep you focused on what actually moves the needle.
          <br />
          <br />
          The goal isn’t “get rich quick”. The goal is a real engine you can run daily — that turns attention
          into clicks, clicks into leads, and leads into commissions (including recurring programs when possible).
        </motion.p>

        <motion.img
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...transition }}
          viewport={{ once: true, amount: 0.2 }}
          src="/media/network-dashboard.jpg"
          alt="Autoaffi dashboard"
          className="rounded-3xl shadow-lg mx-auto w-full max-w-4xl"
        />
      </div>
    </section>
  );
}