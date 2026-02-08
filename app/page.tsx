"use client";

import { motion } from "framer-motion";

// Sektioner – se till att dessa filer finns exakt här:
import Hero from "@/components/Hero";
import AboutAutoaffi from "@/components/AboutAutoaffi";
import WhyChoose from "@/components/WhyChoose";
import SuccessBarrier from "@/components/SuccessBarrier";
import Pricing from "@/components/Pricing";
import AffiliateExplained from "@/components/AffiliateExplained";
import Testimonials from "@/components/Testimonials";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";

/**
 * Enkel transition för att undvika typings-konflikter:
 * bara duration.
 */
const transition = { duration: 0.8 };

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-900 overflow-x-hidden">
      {/* 🌟 HERO */}
      <Hero />

      {/* ✨ ABOUT */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <AboutAutoaffi />
      </motion.div>

      {/* ⚡ WHY CHOOSE */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <WhyChoose />
      </motion.div>

      {/* 🚀 SUCCESS */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <SuccessBarrier />
      </motion.div>

      {/* 💰 PRICING */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <Pricing />
      </motion.div>

      {/* 🧠 AFFILIATE EXPLAINED */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <AffiliateExplained />
      </motion.div>


      {/* 🧩 HOW IT WORKS */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <HowItWorks />
      </motion.div>

      {/* ❓ FAQ */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        <FAQ />
      </motion.div>
    </main>
  );
}