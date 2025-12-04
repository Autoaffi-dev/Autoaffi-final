"use client";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white via-gray-50 to-gray-100 text-gray-900 px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="bg-white border border-gray-100 rounded-3xl shadow-xl p-10 max-w-md w-full text-center"
      >
        <h1 className="text-4xl font-extrabold mb-6">
          Welcome to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            Autoaffi
          </span>
        </h1>
        <p className="text-gray-600 mb-8">
          Log in to manage your campaigns, content and performance with ease.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/login/dashboard" })}
          className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-full font-semibold shadow hover:scale-105 transition-transform"
        >
          Continue with Google
        </button>
      </motion.div>
    </main>
  );
}