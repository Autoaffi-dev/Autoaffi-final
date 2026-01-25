"use client";

import React from "react";
import QrLeadsWidget from "../contact/_components/QrLeadsWidget";

export default function LeadsPage() {
  return (
    <main className="min-h-screen bg-[#07070a] text-white px-6 md:px-12 pt-24 pb-20">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600">
          Contact Manager
        </h1>

        <p className="mt-4 text-center text-white/65">
          Monitor your leads, follow-ups and conversions. QR leads are collected here automatically.
        </p>

        <div className="mt-10">
          <QrLeadsWidget />
        </div>
      </div>
    </main>
  );
}