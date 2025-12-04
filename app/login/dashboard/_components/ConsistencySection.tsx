"use client";

export default function ConsistencySection() {
  return (
    <section
      id="dashboard-consistency"
      className="mb-10 rounded-2xl border border-yellow-500/50 bg-slate-900/70 px-5 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-yellow-300">
        Consistency = Results
      </h2>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-slate-100 md:text-sm">
          Autoaffi follows a simple rule:
          <br />
          <span className="font-semibold text-yellow-300">
            More consistent creators make significantly more affiliate income —
            even with smaller audiences.
          </span>
          <br />
          We recommend aiming for
          <span className="font-semibold text-emerald-300"> 2 posts per day </span>
          on your main platforms. Autoaffi helps you generate, optimize and
          plan content so you don’t burn out.
        </p>

        <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-center">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            Your creator pace
          </p>
          <p className="bg-gradient-to-r from-emerald-300 to-yellow-300 bg-clip-text text-3xl font-bold text-transparent">
            0 / 2
          </p>
          <p className="text-[11px] text-slate-500">posts today</p>
        </div>
      </div>
    </section>
  );
}