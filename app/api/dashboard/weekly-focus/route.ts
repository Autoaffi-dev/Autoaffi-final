import { NextResponse } from "next/server";

import { readDashboardPlan } from "@/lib/billing/dashboardPlan";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return weekNo;
}

function getWeekKeyStockholm() {
  const now = new Date();
  const year = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
  }).format(now);

  const week = String(getISOWeekNumber(now)).padStart(2, "0");
  return `${year}-W${week}`;
}

export async function GET(req: Request) {
  const entitlement = await readDashboardPlan(req);
  if (!entitlement.ok) return entitlement.response;
  const url = new URL(req.url);
  const creatorMode = String(url.searchParams.get("creatorMode") ?? "beginner");
  if (entitlement.effectivePlan === "none") {
    return NextResponse.json({ plan: "none", item: null }, { headers: NO_STORE });
  }
  const plan = entitlement.effectivePlan;
  const weekKey = getWeekKeyStockholm();

  const { data, error } = await supabaseAdmin
    .from("dashboard_weekly_focus_cache")
    .select("week_key, title, actions, add_ons, guardrails, win_condition")
    .eq("week_key", weekKey)
    .eq("creator_mode", creatorMode)
    .eq("plan", plan)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({
    plan,
    item: data
      ? {
          weekKey: data.week_key,
          title: data.title,
          actions: data.actions ?? [],
          addOns: data.add_ons ?? [],
          guardrails: data.guardrails ?? [],
          win: data.win_condition,
        }
      : null,
  }, { headers: NO_STORE });
}
