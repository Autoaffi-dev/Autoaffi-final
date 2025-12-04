"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ContentPlanner() {
  const [idea, setIdea] = useState("");

  const ideas = [
    "🎥 Record a short TikTok explaining how affiliate links work — add your link in bio.",
    "📸 Post a before/after success story image with a caption about growth and patience.",
    "🎤 Share a quick motivational voice-over clip using trending audio.",
    "🧩 Carousel: '5 mistakes affiliates make' — end with a call to action to your funnel.",
  ];

  const generateIdea = () => {
    setIdea(ideas[Math.floor(Math.random() * ideas.length)]);
  };

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-bold text-slate-800 mb-4"
      >
        Content Planner 🧠
      </motion.h2>
      <p className="text-slate-500 mb-6">
        Need inspiration? Get content ideas tailored to affiliate creators.
      </p>

      <button
        onClick={generateIdea}
        className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:scale-105 transition-transform"
      >
        Generate Idea
      </button>

      {idea && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-lg mx-auto mt-6 bg-white p-6 rounded-xl shadow text-slate-700"
        >
          <p>{idea}</p>
        </motion.div>
      )}
    </section>
  );
}