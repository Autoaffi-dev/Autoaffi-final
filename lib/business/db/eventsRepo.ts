import { getSupabaseAdmin } from "@/lib/supabase/server";

export type EventType = "sent" | "reply" | "no" | "stop" | "bounce";

export type ReplyState = "none" | "replied" | "negative" | "stopped";

export type EventRow = {
  event_type: EventType;
  channel: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

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
    .select("created_at")
    .eq("target_id", targetId)
    .eq("event_type", "reply")
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getLatestEventForUser(input: {
  userId: string;
  targetId: string;
}): Promise<EventRow | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_events")
    .select("event_type, channel, meta, created_at")
    .eq("user_id", input.userId)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as EventRow | null) ?? null;
}

export async function getRecentEventsForUser(input: {
  userId: string;
  targetId: string;
  limit?: number;
}): Promise<EventRow[]> {
  const supabase = getSupabaseAdmin();
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));

  const { data, error } = await supabase
    .from("business_events")
    .select("event_type, channel, meta, created_at")
    .eq("user_id", input.userId)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function getReplyStateForUser(input: {
  userId: string;
  targetId: string;
}): Promise<{
  replyState: ReplyState;
  hasReply: boolean;
  shouldStopOutreach: boolean;
  shouldFollowUp: boolean;
  lastEventType: EventType | null;
  lastEventAt: string | null;
}> {
  const latest = await getLatestEventForUser(input);

  if (!latest) {
    return {
      replyState: "none",
      hasReply: false,
      shouldStopOutreach: false,
      shouldFollowUp: false,
      lastEventType: null,
      lastEventAt: null,
    };
  }

  const lastEventType = latest.event_type;
  const lastEventAt = latest.created_at;

  if (lastEventType === "stop") {
    return {
      replyState: "stopped",
      hasReply: false,
      shouldStopOutreach: true,
      shouldFollowUp: false,
      lastEventType,
      lastEventAt,
    };
  }

  if (lastEventType === "no") {
    return {
      replyState: "negative",
      hasReply: false,
      shouldStopOutreach: true,
      shouldFollowUp: false,
      lastEventType,
      lastEventAt,
    };
  }

  if (lastEventType === "reply") {
    return {
      replyState: "replied",
      hasReply: true,
      shouldStopOutreach: false,
      shouldFollowUp: false,
      lastEventType,
      lastEventAt,
    };
  }

  if (lastEventType === "sent") {
    return {
      replyState: "none",
      hasReply: false,
      shouldStopOutreach: false,
      shouldFollowUp: true,
      lastEventType,
      lastEventAt,
    };
  }

  if (lastEventType === "bounce") {
    return {
      replyState: "negative",
      hasReply: false,
      shouldStopOutreach: true,
      shouldFollowUp: false,
      lastEventType,
      lastEventAt,
    };
  }

  return {
    replyState: "none",
    hasReply: false,
    shouldStopOutreach: false,
    shouldFollowUp: false,
    lastEventType,
    lastEventAt,
  };
}