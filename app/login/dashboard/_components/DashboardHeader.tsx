"use client";

interface DashboardHeaderProps {
  heroIntro: boolean;
  isReturningUser?: boolean;
}

export default function DashboardHeader({
  heroIntro,
  isReturningUser = true,
}: DashboardHeaderProps) {
  return (
    <header
      id="dashboard-hero"
      className={`mb-10 transform transition-all duration-700 ${
        heroIntro || isReturningUser
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Autoaffi Dashboard
      </p>

      <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
        {isReturningUser ? "Welcome back," : "Welcome,"}&nbsp;
        <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
          Creator
        </span>
      </h1>

      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
        Welcome back to your second home on the internet. Autoaffi’s number one
        priority is your success and affiliate journey. We will always do our
        best to help you move closer to the goal you are aiming for.
      </p>
    </header>
  );
}