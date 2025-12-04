"use client";

import Link from "next/link";

type Plan = "basic" | "pro" | "elite";

interface DashboardCardProps {
  plan: Plan;              // user’s current plan
  minPlan: Plan;           // minimum required plan for this card
  title: string;
  badge?: string;
  href: string;
  description: string;
  points?: string[];
  comingSoon?: boolean;
}

export default function DashboardCard({
  plan,
  minPlan,
  title,
  badge,
  href,
  description,
  points = [],
  comingSoon = false,
}: DashboardCardProps) {
  // 🔐 LÅST-LOGIK (helt typesafe)
  // - Basic kan inte öppna Pro
  // - Bara Elite kan öppna Elite
  const locked =
    (minPlan === "pro" && plan === "basic") ||
    (minPlan === "elite" && (plan === "basic" || plan === "pro"));

  // Text som visar krav-plan
  const planLabel =
    minPlan === "basic"
      ? "Included in Basic"
      : minPlan === "pro"
      ? "Requires Pro"
      : "Requires Elite";

  return (
    <Link
      href={locked ? "#" : href}
      className={`
        group relative flex h-full flex-col rounded-2xl border p-4 transition
        ${locked
          ? "border-slate-800 bg-slate-900/40 opacity-60 cursor-not-allowed"
          : "border-slate-700/60 bg-slate-900/70 hover:border-emerald-400/60 hover:bg-slate-900"
        }
      `}
    >
      {/* Badge + plan label */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {badge}
            </span>
          )}
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {planLabel}
          </span>
        </div>

        {comingSoon && (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Coming soon
          </span>
        )}
      </div>

      {/* Titel */}
      <h3 className="mb-1 text-sm font-semibold text-slate-50">
        {title}
      </h3>

      {/* Beskrivning */}
      <p className="mb-3 text-[13px] leading-snug text-slate-300">
        {description}
      </p>

      {/* Punkter */}
      {points.length > 0 && (
        <ul className="mb-3 space-y-1.5 text-[12px] text-slate-300">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Låst-label längst ner */}
      {locked && (
        <p className="mt-auto pt-2 text-[11px] text-slate-500">
          Upgrade to <span className="font-semibold">{minPlan}</span> to unlock this.
        </p>
      )}
    </Link>
  );
}