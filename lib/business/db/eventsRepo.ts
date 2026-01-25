import { getSupabaseAdmin } from "@/lib/supabase/server";

export type EventType = "sent" | "reply" | "no" | "stop" | "bounce";

export async function logEvent(input: {
  userId: string;
  targetId: string;
  eventType: EventType;
  channel?: string | null;
  meta?: Record<string, any> | null;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("business_events").insert({
    user_id: input.userId,
    target_id: input.targetId,
    event_type: input.eventType,
    channel: input.channel ?? null,
    meta: input.meta ?? {},
  });

  if (error) throw error;
}

export async function hasAnyReply(targetId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_events")
    .select("id")
    .eq("target_id", targetId)
    .eq("event_type", "reply")
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}