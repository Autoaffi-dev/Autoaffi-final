"use client";
import { motion } from "framer-motion";

export default function CampaignsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-gray-100 px-6 md:px-12 pt-28 pb-16">
      <motion.h1
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="text-4xl md:text-5xl font-extrabold text-center mb-10"
      >
        Manage <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Campaigns</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="max-w-5xl mx-auto bg-white p-10 rounded-3xl shadow-xl border border-gray-100"
      >
        <p className="text-gray-600 mb-8">
          Track and control your affiliate campaigns — view conversions, CTR, and ROI in real-time.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {["Clicks", "Leads", "Revenue"].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 shadow hover:shadow-lg text-center"
            >
              <h3 className="text-xl font-bold mb-2">{stat}</h3>
              <p className="text-3xl font-extrabold text-yellow-500">$0</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </main>
  );
}