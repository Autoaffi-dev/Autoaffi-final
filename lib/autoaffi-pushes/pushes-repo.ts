import { createClient } from "@supabase/supabase-js";
import type { GeneratedPush, SavedPush } from "@/app/login/dashboard/autoaffi-pushes/types";

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function savePushForUser(args: {
  userId: string;
  push: GeneratedPush;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { userId, push } = args;
  const supabase = getSupabaseClient();

  const tone = (push as any).tone ?? "balanced";
  const ctaIntensity = (push as any).ctaIntensity ?? "medium";
  const targetMarket = (push as any).targetMarket ?? "international_english";
  const language = (push as any).language ?? "english";

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
      tone,
      cta_intensity: ctaIntensity,
      target_market: targetMarket,
      language,
      why_this_push_works: push.whyThisPushWorks,
    })
    .select("id")
    .single();

  if (pushError || !pushRow?.id) {
    return {
      ok: false,
      error: pushError?.message || "Failed to save push.",
    };
  }

  const rows = push.days.map((day: any) => ({
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
    image_prompt: day.imagePrompt || "",
    video_script: day.videoScript || [],
    comment_reply: day.commentReply || null,
  }));

  const { error: daysError } = await supabase
    .from("autoaffi_push_days")
    .insert(rows);

  if (daysError) {
    return {
      ok: false,
      error: daysError.message || "Failed to save push days.",
    };
  }

  return {
    ok: true,
    id: pushRow.id,
  };
}

export async function listPushesForUser(userId: string): Promise<SavedPush[]> {
  const supabase = getSupabaseClient();

  const { data: pushes, error } = await supabase
    .from("autoaffi_pushes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !pushes) return [];

  const pushIds = pushes.map((p: any) => p.id);

  const { data: days } = await supabase
    .from("autoaffi_push_days")
    .select("*")
    .in("push_id", pushIds)
    .order("day_number", { ascending: true });

  const groupedDays = new Map<string, any[]>();

  for (const day of days || []) {
    const typedDay = day as any;
    const list = groupedDays.get(typedDay.push_id) || [];
    list.push(typedDay);
    groupedDays.set(typedDay.push_id, list);
  }

  const mapped: SavedPush[] = (pushes as any[]).map((row: any) => ({
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
      tone: row.tone ?? "balanced",
      ctaIntensity: row.cta_intensity ?? "medium",
      targetMarket: row.target_market ?? "international_english",
      language: row.language ?? "english",
      whyThisPushWorks: row.why_this_push_works ?? "",
      days: (groupedDays.get(row.id) || []).map((day: any) => ({
        dayNumber: day.day_number,
        dayTitle: day.day_title,
        dayRole: day.day_role,
        whyThisDayMatters: day.why_this_day_matters ?? "",
        optimizingFor: day.optimizing_for || [],
        hook: day.hook ?? "",
        body: day.body ?? "",
        cta: day.cta ?? "",
        algorithmNote: day.algorithm_note ?? "",
        hashtags: day.hashtags || [],
        keywordFocus: day.keyword_focus || [],
        imagePrompt: day.image_prompt || "",
        videoScript: day.video_script || [],
        commentReply: day.comment_reply || null,
      })),
    },
  }));

  return mapped;
}