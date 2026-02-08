"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 md:px-12"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center text-4xl md:text-5xl font-extrabold mb-8"
      >
        Choose Your Plan
      </motion.h2>

      <p className="text-center text-slate-400 mb-4 max-w-2xl mx-auto">
        Automation, recurring income and AI-powered growth — built for every creator level.
      </p>

      {/* ✅ Din “fee text” tillbaka i min version (globalt, diskret) */}
      <p className="text-center text-slate-500 text-xs mb-14 max-w-2xl mx-auto">
        We cover payment processing — a small 3% fee is added to subscriptions to handle transaction costs.
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* BASIC */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30 p-8 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-2xl font-bold mb-2 text-yellow-400">Basic</h3>
            <p className="text-4xl font-extrabold">$9/mo</p>

            {/* ✅ Din fee-rad under Basic (liten, som på bilden) */}
            <p className="mt-2 text-xs text-slate-500">
              We cover transaction fees with 3% on all our subscriptions.
            </p>

            <ul className="mt-6 space-y-3 text-slate-300 text-sm mb-8">
              <li>✔ Access to commissionable product offers (curated)</li>
              <li>✔ Simple link structure + tracking basics</li>
              <li>✔ Content planning foundations (routine + structure)</li>
              <li>✔ Merchandise-ready QR assets (online + offline growth)</li>
              <li>✔ Daily focus guidance (starter level)</li>
              <li>✔ Email support</li>
            </ul>
          </div>

          <Link
            href="/login"
            className="w-full text-center rounded-full bg-slate-800 hover:bg-slate-700 text-white py-2 font-semibold transition-all"
          >
            Get Started
          </Link>
        </motion.div>

        {/* PRO */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="rounded-3xl border border-yellow-500 bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 shadow-xl shadow-yellow-900/30 p-8 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-2xl font-bold mb-2 text-yellow-400">Pro</h3>
            <p className="text-4xl font-extrabold mb-6">$19/mo</p>

            <ul className="space-y-3 text-slate-300 text-sm mb-8">
              <li>✔ Everything in Basic</li>
              <li>✔ More product offer access + smarter recommendations</li>
              <li>✔ Reels generator workflows (faster content output)</li>
              <li>✔ Growth Engine unlocked (pipeline + outreach templates)</li>
              <li>✔ MLGS Leads: access to stronger lead discovery workflows</li>
              <li>✔ AI Coach (better daily priorities + guidance)</li>
            </ul>
          </div>

          <Link
            href="/login"
            className="w-full text-center rounded-full bg-yellow-500 text-slate-900 font-semibold py-2 hover:bg-yellow-400 transition-all"
          >
            Upgrade to Pro
          </Link>
        </motion.div>

        {/* ELITE */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30 p-8 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-2xl font-bold mb-2 text-yellow-400">Elite</h3>
            <p className="text-4xl font-extrabold mb-6">$39/mo</p>

            <ul className="space-y-3 text-slate-300 text-sm mb-8">
              <li>✔ Everything in Pro</li>
              <li>✔ High-ticket + recurring focus boosted</li>
              <li>✔ Advanced growth workflows + priority support</li>
              <li>✔ Merchandise-ready QR assets (online + offline growth)</li>

              {/* ✅ VIP punkt – stark men inte “guarantee” */}
              <li>
                ✔ Eligibility to earn commission from new Autoaffi subscribers via platform-run campaigns (when available)
              </li>

              <li>✔ VIP support & strategy sessions</li>
            </ul>
          </div>

          <Link
            href="/login"
            className="w-full text-center rounded-full bg-slate-800 hover:bg-slate-700 text-white py-2 font-semibold transition-all"
          >
            Go Elite
          </Link>
        </motion.div>
      </div>
    </section>
  );
}