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
      tone: push.tone,
      cta_intensity: push.ctaIntensity,
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

  const rows = push.days.map((day) => ({
    push_id: pushRow.id,
    day_number: day.dayNumber,
    day_title: day.dayTitle,
    day_role: day.dayRole,
    why_this_day_matters: day.whyThisDayMatters,
    hook: day.hook,
    body: day.body,
    cta: day.cta,
    algorithm_note: day.algorithmNote,
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

  const pushIds = pushes.map((p) => p.id);
  const { data: days } = await supabase
    .from("autoaffi_push_days")
    .select("*")
    .in("push_id", pushIds)
    .order("day_number", { ascending: true });

  const groupedDays = new Map<string, any[]>();
  for (const day of days || []) {
    const list = groupedDays.get(day.push_id) || [];
    list.push(day);
    groupedDays.set(day.push_id, list);
  }

  return pushes.map((row) => ({
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
      whyThisPushWorks: row.why_this_push_works,
      days: (groupedDays.get(row.id) || []).map((day) => ({
        dayNumber: day.day_number,
        dayTitle: day.day_title,
        dayRole: day.day_role,
        whyThisDayMatters: day.why_this_day_matters,
        hook: day.hook,
        body: day.body,
        cta: day.cta,
        algorithmNote: day.algorithm_note,
      })),
    },
  })) as SavedPush[];
}
