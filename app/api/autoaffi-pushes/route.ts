import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRole);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing userId." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    const { data: pushes, error: pushesError } = await supabase
      .from("autoaffi_pushes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (pushesError) {
      return NextResponse.json(
        { ok: false, error: pushesError.message },
        { status: 500 }
      );
    }

    const pushIds = (pushes || []).map((p) => p.id);

    let days: any[] = [];
    if (pushIds.length > 0) {
      const { data: pushDays, error: daysError } = await supabase
        .from("autoaffi_push_days")
        .select("*")
        .in("push_id", pushIds)
        .order("day_number", { ascending: true });

      if (daysError) {
        return NextResponse.json(
          { ok: false, error: daysError.message },
          { status: 500 }
        );
      }

      days = pushDays || [];
    }

    const groupedDays = new Map<string, any[]>();
    for (const day of days) {
      const list = groupedDays.get(day.push_id) || [];
      list.push(day);
      groupedDays.set(day.push_id, list);
    }

    const result = (pushes || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      push: {
        title: row.title,
        pushType: row.push_type,
        platform: row.platform,
        topic: row.topic,
        offerFocus: row.offer_focus || "",
        goal: row.goal,
        durationDays: row.duration_days,
        tone: row.tone,
        ctaIntensity: row.cta_intensity,
        targetMarket: row.target_market || "international_english",
        language: row.language || "english",
        whyThisPushWorks: row.why_this_push_works,
        days: (groupedDays.get(row.id) || []).map((day) => ({
          dayNumber: day.day_number,
          dayTitle: day.day_title,
          dayRole: day.day_role,
          whyThisDayMatters: day.why_this_day_matters,
          optimizingFor: day.optimizing_for || [],
          hook: day.hook,
          body: day.body,
          cta: day.cta,
          algorithmNote: day.algorithm_note,
          hashtags: day.hashtags || [],
          keywordFocus: day.keyword_focus || [],
          imagePrompt: day.image_prompt || "",
          videoScript: day.video_script || [],
          commentReply: day.comment_reply || null,
        })),
      },
    }));

    return NextResponse.json({ ok: true, pushes: result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load pushes." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    const push = body?.push;

    if (!userId || !push) {
      return NextResponse.json(
        { ok: false, error: "Missing userId or push." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    const { data: pushRow, error: pushError } = await supabase
      .from("autoaffi_pushes")
      .insert({
        user_id: userId,
        title: push.title,
        push_type: push.pushType,
        platform: push.platform,
        topic: push.topic,
        offer_focus: push.offerFocus || null,
        goal: push.goal,
        duration_days: push.durationDays,
        tone: push.tone || null,
        cta_intensity: push.ctaIntensity,
        target_market: push.targetMarket || null,
        language: push.language || null,
        why_this_push_works: push.whyThisPushWorks,
      })
      .select("id, created_at")
      .single();

    if (pushError || !pushRow?.id) {
      return NextResponse.json(
        { ok: false, error: pushError?.message || "Failed to save push." },
        { status: 500 }
      );
    }

    const dayRows = (push.days || []).map((day: any) => ({
      push_id: pushRow.id,
      day_number: day.dayNumber,
      day_title: day.dayTitle,
      day_role: day.dayRole,
      why_this_day_matters: day.whyThisDayMatters,
      optimizing_for: day.optimizingFor || [],
      hook: day.hook,
      body: day.body,
      cta: day.cta,
      algorithm_note: day.algorithmNote,
      hashtags: day.hashtags || [],
      keyword_focus: day.keywordFocus || [],
      image_prompt: day.imagePrompt || null,
      video_script: day.videoScript || [],
      comment_reply: day.commentReply || null,
    }));

    if (dayRows.length > 0) {
      const { error: daysError } = await supabase
        .from("autoaffi_push_days")
        .insert(dayRows);

      if (daysError) {
        return NextResponse.json(
          { ok: false, error: daysError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      id: pushRow.id,
      createdAt: pushRow.created_at,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save push." },
      { status: 500 }
    );
  }
}