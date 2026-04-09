"use client";

import { motion } from "framer-motion";

export default function PushesHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="text-center"
    >
      <p className="text-[11px] md:text-xs uppercase tracking-[0.28em] text-yellow-300/80 font-semibold">
        Pro Engine
      </p>

      <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
        <span className="text-white">Autoaffi </span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600">
          Pushes
        </span>
      </h1>

      <p className="mt-5 max-w-3xl mx-auto text-sm md:text-base text-white/65 leading-7">
        Generate focused 5–7 day pushes designed to create the signals
        algorithms love — curiosity, engagement, comments, saves and follows —
        while warming people up for the right offer over time.
      </p>
    </motion.div>
  );
}
