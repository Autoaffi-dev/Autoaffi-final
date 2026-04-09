import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function utcDateString() {
  // YYYY-MM-DD in UTC
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultDailyPost() {
  // Placeholder – koppla in din riktiga Posts Generator senare
  return {
    title: "Your Daily Post",
    hook: "One small win today can change your whole month.",
    caption:
      "Post this today. Keep it simple. Consistency beats intensity.\n\nCTA: Comment 'AUTO' and I’ll send you the steps.",
    hashtags: ["#affiliate", "#makemoneyonline", "#creator", "#autoaffi"],
    createdBy: "daily-engine-v1",
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = utcDateString();
  const content_type = "post";

  // 1) Try fetch
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("daily_dashboard_content")
    .select("*")
    .eq("user_id", userId)
    .eq("content_date", today)
    .eq("content_type", content_type)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, item: existing }, { status: 200 });
  }

  // 2) Create today’s row if missing
  const payload = buildDefaultDailyPost();

  const { data: created, error: insertErr } = await supabaseAdmin
    .from("daily_dashboard_content")
    .insert({
      user_id: userId,
      content_date: today,
      content_type,
      payload,
      status: "ready",
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: created }, { status: 200 });
}
