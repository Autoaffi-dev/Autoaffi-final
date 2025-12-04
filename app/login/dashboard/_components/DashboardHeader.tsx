"use client";

interface DashboardHeaderProps {
  heroIntro: boolean;
}

export default function DashboardHeader({ heroIntro }: DashboardHeaderProps) {
  return (
    <header
      id="dashboard-hero"
      className={`mb-10 transform transition-all duration-700 ${
        heroIntro ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Autoaffi Dashboard
      </p>

      <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
        Welcome back,&nbsp;
        <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
          Creator
        </span>
      </h1>

      <p className="mt-2 max-w-xl text-sm text-slate-400 md:text-base">
        Everything you need to grow your affiliate income — content, offers,
        analytics, funnels, trends & automation. This is your home for
        predictable online revenue.
      </p>
    </header>
  );
}