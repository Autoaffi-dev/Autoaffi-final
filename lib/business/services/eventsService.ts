import { logEvent, EventType } from "../db/eventsRepo";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Business event automation:
 * - loggar event
 * - uppdaterar last_activity_at på claim
 * - uppdaterar pipeline-status när det är rimligt
 * - skapar suppression automatiskt vid NO / STOP / BOUNCE
 */
export async function recordBusinessEvent(input: {
  userId: string;
  targetId: string;
  eventType: EventType;
  channel?: string | null; // "email"|"dm"|"form"
  meta?: Record<string, any> | null;
}) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // 1) Always log the raw event first
  await logEvent({
    userId: input.userId,
    targetId: input.targetId,
    eventType: input.eventType,
    channel: input.channel ?? null,
    meta: input.meta ?? null,
  });

  // 2) Touch claim activity if claim exists
  await supabase
    .from("business_claims")
    .update({ last_activity_at: nowIso })
    .eq("target_id", input.targetId);

  // 3) Event-specific automation
  if (input.eventType === "sent") {
    // Keep pipeline as CLAIMED if user is actively working the lead
    await supabase
      .from("business_pipeline")
      .update({
        status: "CLAIMED",
        updated_at: nowIso,
      })
      .eq("user_id", input.userId)
      .eq("target_id", input.targetId);

    return;
  }

  if (input.eventType === "reply") {
    // Positive or at least active state — keep it alive, do not suppress
    await supabase
      .from("business_pipeline")
      .update({
        status: "CLAIMED",
        updated_at: nowIso,
      })
      .eq("user_id", input.userId)
      .eq("target_id", input.targetId);

    return;
  }

  if (input.eventType === "no") {
    // Soft negative but should stop future outreach
    await supabase
      .from("business_pipeline")
      .update({
        status: "SUPPRESSED",
        updated_at: nowIso,
      })
      .eq("user_id", input.userId)
      .eq("target_id", input.targetId);

    // Create hard suppression if not already active
    const { data: existingSuppressions, error: suppressionLookupError } = await supabase
      .from("business_suppressions")
      .select("type, suppressed_until")
      .eq("target_id", input.targetId);

    if (suppressionLookupError) {
      throw suppressionLookupError;
    }

    const hasActiveSuppression = (existingSuppressions ?? []).some((row: any) => {
      if (!row?.suppressed_until) return true;
      return new Date(row.suppressed_until).getTime() > Date.now();
    });

    if (!hasActiveSuppression) {
      const { error: insertSuppressionError } = await supabase
        .from("business_suppressions")
        .insert({
          target_id: input.targetId,
          type: "hard",
          reason: "negative_reply_no",
          suppressed_at: nowIso,
          suppressed_until: null,
        });

      if (insertSuppressionError) throw insertSuppressionError;
    }

    // Remove active claim if present
    await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", input.targetId)
      .eq("claimed_by", input.userId);

    return;
  }

  if (input.eventType === "stop") {
    // Explicit stop = hard suppression immediately
    await supabase
      .from("business_pipeline")
      .update({
        status: "SUPPRESSED",
        updated_at: nowIso,
      })
      .eq("user_id", input.userId)
      .eq("target_id", input.targetId);

    const { data: existingSuppressions, error: suppressionLookupError } = await supabase
      .from("business_suppressions")
      .select("type, suppressed_until")
      .eq("target_id", input.targetId);

    if (suppressionLookupError) {
      throw suppressionLookupError;
    }

    const hasActiveSuppression = (existingSuppressions ?? []).some((row: any) => {
      if (!row?.suppressed_until) return true;
      return new Date(row.suppressed_until).getTime() > Date.now();
    });

    if (!hasActiveSuppression) {
      const { error: insertSuppressionError } = await supabase
        .from("business_suppressions")
        .insert({
          target_id: input.targetId,
          type: "hard",
          reason: "explicit_stop",
          suppressed_at: nowIso,
          suppressed_until: null,
        });

      if (insertSuppressionError) throw insertSuppressionError;
    }

    await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", input.targetId)
      .eq("claimed_by", input.userId);

    return;
  }

  if (input.eventType === "bounce") {
    // Bounce = bad contact path, stop outreach for now
    await supabase
      .from("business_pipeline")
      .update({
        status: "SUPPRESSED",
        updated_at: nowIso,
      })
      .eq("user_id", input.userId)
      .eq("target_id", input.targetId);

    const { data: existingSuppressions, error: suppressionLookupError } = await supabase
      .from("business_suppressions")
      .select("type, suppressed_until")
      .eq("target_id", input.targetId);

    if (suppressionLookupError) {
      throw suppressionLookupError;
    }

    const hasActiveSuppression = (existingSuppressions ?? []).some((row: any) => {
      if (!row?.suppressed_until) return true;
      return new Date(row.suppressed_until).getTime() > Date.now();
    });

    if (!hasActiveSuppression) {
      const { error: insertSuppressionError } = await supabase
        .from("business_suppressions")
        .insert({
          target_id: input.targetId,
          type: "hard",
          reason: "bounce_invalid_contact",
          suppressed_at: nowIso,
          suppressed_until: null,
        });

      if (insertSuppressionError) throw insertSuppressionError;
    }

    await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", input.targetId)
      .eq("claimed_by", input.userId);

    return;
  }
}