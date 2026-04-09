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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminSupabase();

    const { data: pushRow, error: pushError } = await supabase
      .from("autoaffi_pushes")
      .select("*")
      .eq("id", id)
      .single();

    if (pushError || !pushRow) {
      return NextResponse.json(
        { ok: false, error: pushError?.message || "Push not found." },
        { status: 404 }
      );
    }

    const { data: days, error: daysError } = await supabase
      .from("autoaffi_push_days")
      .select("*")
      .eq("push_id", id)
      .order("day_number", { ascending: true });

    if (daysError) {
      return NextResponse.json(
        { ok: false, error: daysError.message },
        { status: 500 }
      );
    }

    const result = {
      id: pushRow.id,
      userId: pushRow.user_id,
      createdAt: pushRow.created_at,
      push: {
        title: pushRow.title,
        pushType: pushRow.push_type,
        platform: pushRow.platform,
        topic: pushRow.topic,
        offerFocus: pushRow.offer_focus || "",
        goal: pushRow.goal,
        durationDays: pushRow.duration_days,
        tone: pushRow.tone,
        ctaIntensity: pushRow.cta_intensity,
        targetMarket: pushRow.target_market || "international_english",
        language: pushRow.language || "english",
        whyThisPushWorks: pushRow.why_this_push_works,
        days: (days || []).map((day) => ({
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
    };

    return NextResponse.json({ ok: true, push: result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load push." },
      { status: 500 }
    );
  }
}