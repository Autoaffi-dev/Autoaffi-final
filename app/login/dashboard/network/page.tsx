"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function NetworkPage() {
  const [boostEnabled, setBoostEnabled] = useState(true);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-900 p-8">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="max-w-5xl mx-auto"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            Autoaffi Network
          </span>
        </h1>

        <p className="text-center text-gray-600 max-w-2xl mx-auto mb-12">
          Connect with other affiliates and boost each other’s reach. 
          Community Boost helps all active members like and comment on each other’s posts — automatically increasing visibility.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="bg-white shadow-xl rounded-3xl p-8 border border-gray-100 mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Community Boost</h2>
            <Switch checked={boostEnabled} onCheckedChange={setBoostEnabled} />
          </div>

          <p className="text-gray-600 mb-4">
            When enabled, your posts are automatically boosted by other Autoaffi members.
            This helps your content gain more visibility on social platforms.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-center mt-8">
            <div className="p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-2xl shadow-sm">
              <h3 className="text-3xl font-extrabold text-yellow-600 mb-2">12</h3>
              <p className="text-gray-700">Posts Boosted This Week</p>
            </div>
            <div className="p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-2xl shadow-sm">
              <h3 className="text-3xl font-extrabold text-yellow-600 mb-2">324</h3>
              <p className="text-gray-700">Community Interactions</p>
            </div>
            <div className="p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-2xl shadow-sm">
              <h3 className="text-3xl font-extrabold text-yellow-600 mb-2">89 %</h3>
              <p className="text-gray-700">Boost Engagement Rate</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="text-center text-gray-500"
        >
          <p>
            Want to grow faster? Invite others to join Autoaffi and build the strongest affiliate
            network together.
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}