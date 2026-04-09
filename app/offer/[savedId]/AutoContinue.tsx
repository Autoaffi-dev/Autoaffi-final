"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  continueUrl: string;
  sourceUrl?: string | null;
};

export default function AutoContinue({ continueUrl, sourceUrl }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 1;
        return prev - 1;
      });
    }, 1000);

    const timeout = window.setTimeout(() => {
      window.location.href = continueUrl;
    }, 10000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(timeout);
    };
  }, [continueUrl]);

  return (
    <div className="mt-6">
      <p className="mb-3 text-[12px] text-slate-400">
        You will continue automatically in{" "}
        <span className="font-semibold text-yellow-300">{secondsLeft}</span>{" "}
        seconds.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={continueUrl}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-[13px] font-semibold text-slate-900 shadow-md hover:brightness-110 transition"
        >
          Continue to Product
        </Link>

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-6 py-3 text-[13px] font-semibold text-slate-200 hover:bg-slate-900 transition"
          >
            View Source Page
          </a>
        ) : null}

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-6 py-3 text-[13px] font-semibold text-slate-200 hover:bg-slate-900 transition"
        >
          Back
        </button>
      </div>
    </div>
  );
}