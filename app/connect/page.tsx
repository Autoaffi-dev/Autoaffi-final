"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ConsentModal from "@/components/ConsentModal";

export default function ConnectPage() {
  const [connectionState, setConnectionState] = useState<"idle" | "pending" | "connected">("idle");

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col items-center justify-center text-gray-800">
      <motion.h1
        className="text-4xl font-extrabold mb-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        Connect Your{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
          Social Accounts
        </span>
      </motion.h1>

      {connectionState === "idle" && (
        <motion.button
          onClick={() => setConnectionState("pending")}
          className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-full font-semibold shadow-md hover:shadow-lg transition animate-pulse"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeInOut" }}
        >
          Connect Account
        </motion.button>
      )}

      {connectionState === "pending" && (
        <ConsentModal
          onAccept={() => setConnectionState("connected")}
          onDecline={() => setConnectionState("idle")}
        />
      )}

      {connectionState === "connected" && (
        <motion.div
          className="flex flex-col items-center text-center mt-6 space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <p className="text-lg font-semibold text-green-600">✅ Connection Successful!</p>
          <p className="text-gray-600 max-w-sm">
            Your account is now synced. Autoaffi can analyze and help optimize your posts automatically.
          </p>
        </motion.div>
      )}
    </main>
  );
}