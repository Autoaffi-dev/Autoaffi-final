"use client";

import { motion } from "framer-motion";

export default function PushesEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.08 }}
      className="mt-12 rounded-3xl border border-yellow-500/20 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.35)]"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            Why it exists
          </p>
          <p className="mt-3 text-sm text-white/70 leading-6">
            Autoaffi Pushes is not built to make every post sound like a sales
            pitch. It helps users build momentum, trust and engagement first.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            What it helps with
          </p>
          <p className="mt-3 text-sm text-white/70 leading-6">
            Stronger comments, saves, follows and curiosity — with smarter
            warming toward offers over several days instead of hard selling
            every day.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yellow-300/80 font-semibold">
            How to use it
          </p>
          <p className="mt-3 text-sm text-white/70 leading-6">
            Pick a push type, enter your topic and goal, then let Autoaffi
            generate a full multi-day push you can copy, download and post
            directly.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-yellow-500/25 bg-black/20 p-6 text-center">
        <p className="text-sm text-white/55">
          Choose your push type and generate your first Autoaffi Push.
        </p>
      </div>
    </motion.div>
  );
}
