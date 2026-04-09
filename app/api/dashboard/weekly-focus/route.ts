import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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
  const url = new URL(req.url);
  const creatorMode = String(url.searchParams.get("creatorMode") ?? "beginner");
  const plan = String(url.searchParams.get("plan") ?? "basic");
  const weekKey = getWeekKeyStockholm();

  const { data, error } = await supabaseAdmin
    .from("dashboard_weekly_focus_cache")
    .select("week_key, title, actions, add_ons, guardrails, win_condition")
    .eq("week_key", weekKey)
    .eq("creator_mode", creatorMode)
    .eq("plan", plan)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
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
  });
}
