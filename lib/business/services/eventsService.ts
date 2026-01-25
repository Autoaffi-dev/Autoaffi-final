import { logEvent, EventType } from "../db/eventsRepo";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * V1: Logga events så vi kan:
 * - veta om lead svarat (reply)
 * - veta om "NO/STOP" inkommit
 * - använda 45-dagars cooldown korrekt
 * - uppdatera last_activity_at på claim
 */
export async function recordBusinessEvent(input: {
  userId: string;
  targetId: string;
  eventType: EventType;
  channel?: string | null; // "email"|"dm"|"form"
  meta?: Record<string, any> | null;
}) {
  await logEvent({
    userId: input.userId,
    targetId: input.targetId,
    eventType: input.eventType,
    channel: input.channel ?? null,
    meta: input.meta ?? null,
  });

  // Touch last_activity_at if claimed (så vi kan göra bättre regler senare)
  const supabase = getSupabaseAdmin();
  await supabase
    .from("business_claims")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("target_id", input.targetId);
}