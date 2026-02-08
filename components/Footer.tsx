"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800 px-6 md:px-12 py-12 text-slate-400 text-sm">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="max-w-6xl mx-auto flex flex-col gap-8"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Autoaffi
            </p>
            <p className="mt-2 text-slate-500 max-w-md">
              A structured system for affiliate creators — built to remove friction,
              create consistency, and help you scale winners faster.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <Link href="#pricing" className="hover:text-yellow-400 transition">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-yellow-400 transition">
              FAQ
            </Link>
            <Link href="/login" className="hover:text-yellow-400 transition">
              Login
            </Link>
            <Link href="/privacy" className="hover:text-yellow-400 transition">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-yellow-400 transition">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-yellow-400 transition">
              Data Deletion
            </Link>
            <a
              href="mailto:support@autoaffi.com"
              className="hover:text-yellow-400 transition"
            >
              Contact
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-slate-800 pt-6">
          <p className="text-slate-500">
            © {new Date().getFullYear()}{" "}
            <span className="text-yellow-400 font-semibold">Autoaffi</span>. All
            rights reserved.
          </p>

          <p className="text-xs text-slate-600 max-w-2xl">
            Autoaffi is a productivity and automation platform. We do not guarantee
            earnings. Results vary based on niche, consistency, offer quality, and
            execution.
          </p>
        </div>
      </motion.div>
    </footer>
  );
}
