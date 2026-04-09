import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function getDayKeyStockholm(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d).replaceAll("-", "-");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const creatorMode = String(url.searchParams.get("creatorMode") ?? "beginner");
  const plan = String(url.searchParams.get("plan") ?? "basic");
  const dayKey = getDayKeyStockholm();

  const [{ data, error }, { data: preview }] = await Promise.all([
    supabaseAdmin
      .from("user_daily_post_delivery")
      .select("enabled, email, last_sent_day_key")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("dashboard_daily_content_cache")
      .select("email_subject")
      .eq("day_key", dayKey)
      .eq("creator_mode", creatorMode)
      .eq("plan", plan)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    enabled: data?.enabled ?? false,
    email: data?.email ?? email,
    latest_day_key: data?.last_sent_day_key ?? null,
    preview_subject: preview?.email_subject ?? null,
    next_run_label: "Every day after midnight (Europe/Stockholm)",
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json(
      { error: "No email found on this account." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const enabled = !!body?.enabled;
  const creatorMode = String(body?.creatorMode ?? "beginner");
  const plan = String(body?.plan ?? "basic");
  const dayKey = getDayKeyStockholm();

  const [{ data, error }, { data: preview }] = await Promise.all([
    supabaseAdmin
      .from("user_daily_post_delivery")
      .upsert(
        {
          user_id: userId,
          email,
          enabled,
        },
        { onConflict: "user_id" }
      )
      .select("enabled, email, last_sent_day_key")
      .single(),
    supabaseAdmin
      .from("dashboard_daily_content_cache")
      .select("email_subject")
      .eq("day_key", dayKey)
      .eq("creator_mode", creatorMode)
      .eq("plan", plan)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    enabled: data.enabled,
    email: data.email,
    latest_day_key: data.last_sent_day_key ?? null,
    preview_subject: preview?.email_subject ?? null,
    next_run_label: "Every day after midnight (Europe/Stockholm)",
  });
}