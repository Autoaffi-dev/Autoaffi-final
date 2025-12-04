"use client";

import React from "react";

interface SectionBlockProps {
  id?: string;
  title: string;
  subtitle?: string;
  highlighted?: boolean;
  children: React.ReactNode;
}

export default function SectionBlock({
  id,
  title,
  subtitle,
  highlighted,
  children,
}: SectionBlockProps) {
  return (
    <section
      id={id}
      className={`mb-12 ${
        highlighted ? "rounded-2xl ring-1 ring-yellow-500/35 bg-slate-950/40" : ""
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
          {title}
        </h2>

        {subtitle && (
          <p className="max-w-xl text-[11px] text-slate-500">{subtitle}</p>
        )}
      </div>

      {children}
    </section>
  );
}