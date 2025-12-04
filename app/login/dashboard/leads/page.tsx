"use client";
import { motion } from "framer-motion";

export default function LeadsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100 px-6 md:px-12 pt-28 pb-16">
      <motion.h1
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="text-4xl md:text-5xl font-extrabold text-center mb-10"
      >
        Lead <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Manager</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="max-w-5xl mx-auto bg-white p-10 rounded-3xl shadow-xl border border-gray-100"
      >
        <p className="text-gray-600 mb-6">
          Monitor your leads, conversions, and referral performance.
        </p>
        <table className="w-full border-collapse text-left text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="py-2">Lead</th>
              <th className="py-2">Source</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3">—</td>
              <td className="py-3">—</td>
              <td className="py-3 text-gray-400">No data yet</td>
            </tr>
          </tbody>
        </table>
      </motion.div>
    </main>
  );
}