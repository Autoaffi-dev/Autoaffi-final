"use client";

import { useState } from "react";
import { entitlementLabel, type EntitlementView } from "@/lib/billing/entitlementView";

export interface PlanStripProps {
  view: EntitlementView;
  beginnerHoursLeft: number | null;
}

export default function PlanStrip({ view, beginnerHoursLeft }: PlanStripProps) {
  const [billingMessage, setBillingMessage] = useState("");
  const label = entitlementLabel(view);
  const paid = view.status === "ready" && view.plan !== "none";

  async function openBilling() {
    setBillingMessage("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (response.ok && body?.url) {
        window.location.assign(body.url);
        return;
      }
      setBillingMessage(body?.error || "Billing could not be opened.");
    } catch {
      setBillingMessage("Billing could not be opened.");
    }
  }

  return (
    <section className="border-b border-emerald-400/20 bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Your plan
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-100">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {label}
            </span>

            {paid && view.plan !== "elite" && (
              <span className="text-[11px] text-slate-400">
                Upgrade to unlock Elite Engines & advanced automation.
              </span>
            )}
          </div>

          {beginnerHoursLeft !== null && beginnerHoursLeft > 0 && (
            <p className="mt-1 text-[11px] text-emerald-300/80">
              Beginner boost active for ~{beginnerHoursLeft}h — extra guidance is on.
            </p>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => void openBilling()}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
          >
            View billing
          </button>
          {billingMessage ? <span className="text-slate-400">{billingMessage}</span> : null}

          {paid && view.plan !== "elite" && (
            <button className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400">
              See Elite benefits
            </button>
          )}
        </div>
      </div>
    </section>
  );
}