"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ConsentModal({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [visible, setVisible] = useState(true);

  const handleAccept = () => {
    setVisible(false);
    onAccept();
  };

  const handleDecline = () => {
    setVisible(false);
    onDecline();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <motion.div
            className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 text-gray-800"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <h2 className="text-2xl font-bold mb-4 text-center">
              Connect Your Social Account
            </h2>
            <p className="text-gray-600 mb-6 text-center leading-relaxed">
              By connecting, you allow <span className="text-yellow-600 font-semibold">Autoaffi</span>
              to analyze your recent posts and suggest improved hooks, captions, and affiliate links
              that fit your content style.
            </p>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6 text-sm text-gray-700">
              <ul className="list-disc list-inside space-y-1">
                <li>We only access content you approve.</li>
                <li>No data is sold or shared externally.</li>
                <li>You can revoke access anytime from your settings.</li>
              </ul>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleDecline}
                className="px-5 py-2 rounded-full border border-gray-300 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                className="px-6 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-semibold shadow-md hover:shadow-lg transition animate-pulse"
              >
                Accept & Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}