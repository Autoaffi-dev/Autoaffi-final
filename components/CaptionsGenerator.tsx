"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function CaptionsGenerator() {
  const [topic, setTopic] = useState("");
  const [caption, setCaption] = useState("");

  const generateCaption = () => {
    const captions = [
      `Building your dream life starts with one post. Stay consistent, stay focused.`,
      `You don’t need more followers — you need a strategy. Autoaffi gives you both.`,
      `Every caption is a chance to convert curiosity into commission. Start today.`,
    ];
    setCaption(captions[Math.floor(Math.random() * captions.length)]);
  };

  return (
    <section className="py-20 bg-white text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-bold text-slate-800 mb-4"
      >
        AI Caption Writer ✍️
      </motion.h2>
      <p className="text-slate-500 mb-6">
        Generate engaging captions that convert browsers into buyers.
      </p>

      <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-8">
        <input
          type="text"
          placeholder="Enter your topic..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 w-64"
        />
        <button
          onClick={generateCaption}
          className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:scale-105 transition-transform"
        >
          Generate Caption
        </button>
      </div>

      {caption && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-xl mx-auto bg-slate-50 p-6 rounded-xl shadow text-slate-700"
        >
          <p>{caption}</p>
        </motion.div>
      )}
    </section>
  );
}