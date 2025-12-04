"use client";

import { motion } from "framer-motion";

// Sektioner – se till att dessa filer finns exakt här:
import Hero from "@/components/Hero";
import AboutAutoaffi from "@/components/AboutAutoaffi";
import WhyChoose from "@/components/WhyChoose";
import SuccessBarrier from "@/components/SuccessBarrier";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

/**
 * Vi håller transition enkel för att undvika typings-konflikter:
 * bara duration, ingen custom ease (som orsakat TS-felen tidigare).
 */
const transition = { duration: 0.8 };

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-900 overflow-x-hidden">
      {/* 🌟 HERO */}
      <Hero />

      {/* ✨ ABOUT */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <AboutAutoaffi />
      </motion.div>

      {/* ⚡ WHY CHOOSE */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <WhyChoose />
      </motion.div>

      {/* 🚀 SUCCESS BARRIER (v5-style, interaktiv slider + barometer) */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <SuccessBarrier />
      </motion.div>

      {/* 💰 PRICING */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <Pricing />
      </motion.div>

      {/* 💬 TESTIMONIALS */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <Testimonials />
      </motion.div>

      {/* ❓ FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <FAQ />
      </motion.div>

    </main>
  );
}