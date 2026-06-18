import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasAnyReply } from "../db/eventsRepo";

type CooldownRunResultItem = {
  targetId: string;
  userId: string;
  action: "cooldown_applied" | "skipped";
  reason: string;
};

type CooldownRunResult = {
  scanned: number;
  applied: number;
  skipped: number;
  items: CooldownRunResultItem[];
};

type ClaimedRow = {
  target_id: string;
  claimed_by: string;
  last_activity_at: string | null;
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function runCooldownMaintenance(input?: {
  inactiveDays?: number;
  cooldownDays?: number;
  limit?: number;
}): Promise<CooldownRunResult> {
  const supabase = getSupabaseAdmin();

  // ✅ viktigt: tillåt 0 i testläge
  const inactiveDays = Math.max(0, Number(input?.inactiveDays ?? 45));
  const cooldownDays = Math.max(1, Number(input?.cooldownDays ?? 90));
  const limit = Math.min(500, Math.max(1, Number(input?.limit ?? 100)));

  const inactiveBeforeIso = daysAgoIso(inactiveDays);
  const suppressedUntilIso = addDaysIso(cooldownDays);
  const nowIso = new Date().toISOString();

  // 1) Find old claims that look inactive
  const { data: claimRows, error: claimsError } = await supabase
    .from("business_claims")
    .select("target_id, claimed_by, last_activity_at")
    .lte("last_activity_at", inactiveBeforeIso)
    .limit(limit);

  if (claimsError) {
    throw new Error(`Failed to load old claims: ${claimsError.message}`);
  }

  const claims = (claimRows ?? []) as ClaimedRow[];

  const result: CooldownRunResult = {
    scanned: claims.length,
    applied: 0,
    skipped: 0,
    items: [],
  };

  for (const claim of claims) {
    const targetId = claim.target_id;
    const userId = claim.claimed_by;

    if (!targetId || !userId) {
      result.skipped += 1;
      result.items.push({
        targetId: targetId ?? "",
        userId: userId ?? "",
        action: "skipped",
        reason: "missing_target_or_user",
      });
      continue;
    }

    // 2) Skip if there is any reply
    const replied = await hasAnyReply(targetId);
    if (replied) {
      result.skipped += 1;
      result.items.push({
        targetId,
        userId,
        action: "skipped",
        reason: "has_reply",
      });
      continue;
    }

    // 3) Skip if already won
    const { data: winRows, error: winsError } = await supabase
      .from("business_wins")
      .select("target_id")
      .eq("target_id", targetId)
      .limit(1);

    if (winsError) {
      throw new Error(`Failed to check wins: ${winsError.message}`);
    }

    if ((winRows?.length ?? 0) > 0) {
      result.skipped += 1;
      result.items.push({
        targetId,
        userId,
        action: "skipped",
        reason: "already_won",
      });
      continue;
    }

    // 4) Skip if there is active hard suppression or active cooldown already
    const { data: suppressionRows, error: suppressionError } = await supabase
      .from("business_suppressions")
      .select("type, suppressed_until")
      .eq("target_id", targetId);

    if (suppressionError) {
      throw new Error(`Failed to check suppressions: ${suppressionError.message}`);
    }

    const hasActiveSuppression = (suppressionRows ?? []).some((row: any) => {
      if (!row?.suppressed_until) return true; // hard/permanent
      return new Date(row.suppressed_until).getTime() > Date.now();
    });

    if (hasActiveSuppression) {
      result.skipped += 1;
      result.items.push({
        targetId,
        userId,
        action: "skipped",
        reason: "already_suppressed",
      });
      continue;
    }

    // 5) Apply cooldown suppression
    const { error: insertSuppressionError } = await supabase
      .from("business_suppressions")
      .insert({
        target_id: targetId,
        type: "cooldown",
        reason: "no_reply_45d",
        suppressed_at: nowIso,
        suppressed_until: suppressedUntilIso,
      });

    if (insertSuppressionError) {
      throw new Error(
        `Failed to insert cooldown suppression: ${insertSuppressionError.message}`
      );
    }

    // 6) Remove claim
    const { error: deleteClaimError } = await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", targetId)
      .eq("claimed_by", userId);

    if (deleteClaimError) {
      throw new Error(`Failed to delete claim: ${deleteClaimError.message}`);
    }

    // 7) Update pipeline row for that user + target
    const { error: updatePipelineError } = await supabase
      .from("business_pipeline")
      .update({
        status: "COOLDOWN",
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .eq("target_id", targetId);

    if (updatePipelineError) {
      throw new Error(`Failed to update pipeline: ${updatePipelineError.message}`);
    }

    result.applied += 1;
    result.items.push({
      targetId,
      userId,
      action: "cooldown_applied",
      reason: "inactive_no_reply",
    });
  }

  result.skipped = result.items.filter((x) => x.action === "skipped").length;
  return result;
}