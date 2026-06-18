import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBusinessDetails } from "./detailsService";
import { getOutreachGuidance } from "./outreachGuidanceService";
import { getReplyStateForUser } from "../db/eventsRepo";
import type { BusinessAvailability } from "../types";

type LeadDetailsInput = {
  userId: string;
  source: "places" | "registry";
  sourceId: string;
};

function deriveAvailability(input: {
  hasActiveSuppression: boolean;
  pipelineStatus?: string | null;
  hasWin?: boolean;
}): BusinessAvailability {
  if (input.hasActiveSuppression) return "suppressed";
  if (input.hasWin) return "won_by_me";
  if (input.pipelineStatus === "CLAIMED") return "claimed_by_me";
  return "available";
}

export async function getLeadDetails(input: LeadDetailsInput) {
  const supabase = getSupabaseAdmin();

  const details = await getBusinessDetails({
    source: input.source,
    sourceId: input.sourceId,
  });

  if (!details.found || !details.targetId || !details.target) {
    return {
      found: false as const,
      targetId: null,
      target: null,
      pipeline: null,
      suppressions: [],
      activeSuppressions: [],
      win: null,
      events: [],
      guidance: null,
      availability: "available" as BusinessAvailability,
      replyState: "none" as const,
      hasReply: false,
      shouldStopOutreach: false,
      shouldFollowUp: false,
      lastEventType: null,
      lastEventAt: null,
      flags: {
        hasPipeline: false,
        hasActiveSuppression: false,
        hasWin: false,
        hasEvents: false,
        hasGuidance: false,
        hasReply: false,
        shouldStopOutreach: false,
        shouldFollowUp: false,
      },
    };
  }

  const targetId = details.targetId;

  const [pipelineRes, suppressionsRes, winsRes, eventsRes, guidance, replyState] =
    await Promise.all([
      supabase
        .from("business_pipeline")
        .select("id, status, score, why, contact_strategy, created_at, updated_at")
        .eq("user_id", input.userId)
        .eq("target_id", targetId)
        .maybeSingle(),

      supabase
        .from("business_suppressions")
        .select("target_id, type, reason, suppressed_at, suppressed_until")
        .eq("target_id", targetId)
        .order("suppressed_at", { ascending: false }),

      supabase
        .from("business_wins")
        .select("target_id, campaign_id, won_at, user_id")
        .eq("target_id", targetId)
        .eq("user_id", input.userId)
        .order("won_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("business_events")
        .select("id, event_type, channel, meta, created_at")
        .eq("user_id", input.userId)
        .eq("target_id", targetId)
        .order("created_at", { ascending: false })
        .limit(20),

      getOutreachGuidance({
        source: input.source,
        sourceId: input.sourceId,
      }),

      getReplyStateForUser({
        userId: input.userId,
        targetId,
      }),
    ]);

  if (pipelineRes.error) {
    throw new Error(`Failed to load pipeline row: ${pipelineRes.error.message}`);
  }

  if (suppressionsRes.error) {
    throw new Error(`Failed to load suppressions: ${suppressionsRes.error.message}`);
  }

  if (winsRes.error) {
    throw new Error(`Failed to load wins: ${winsRes.error.message}`);
  }

  if (eventsRes.error) {
    throw new Error(`Failed to load events: ${eventsRes.error.message}`);
  }

  const suppressions = suppressionsRes.data ?? [];
  const now = Date.now();

  const activeSuppressions = suppressions.filter((row: any) => {
    if (!row?.suppressed_until) return true;
    const until = new Date(row.suppressed_until).getTime();
    return Number.isFinite(until) && until > now;
  });

  const hasWin = !!winsRes.data;

  const availability = deriveAvailability({
    hasActiveSuppression: activeSuppressions.length > 0,
    pipelineStatus: pipelineRes.data?.status ?? null,
    hasWin,
  });

  return {
    found: true as const,
    targetId,
    target: details.target,
    providerDetails: details.providerDetails ?? null,
    pipeline: pipelineRes.data ?? null,
    suppressions,
    activeSuppressions,
    win: winsRes.data ?? null,
    events: eventsRes.data ?? [],
    guidance: guidance.found ? guidance : null,
    availability,

    replyState: replyState.replyState,
    hasReply: replyState.hasReply,
    shouldStopOutreach: replyState.shouldStopOutreach,
    shouldFollowUp: replyState.shouldFollowUp,
    lastEventType: replyState.lastEventType,
    lastEventAt: replyState.lastEventAt,

    flags: {
      hasPipeline: !!pipelineRes.data,
      hasActiveSuppression: activeSuppressions.length > 0,
      hasWin,
      hasEvents: (eventsRes.data?.length ?? 0) > 0,
      hasGuidance: !!guidance?.found,
      hasReply: replyState.hasReply,
      shouldStopOutreach: replyState.shouldStopOutreach,
      shouldFollowUp: replyState.shouldFollowUp,
    },
  };
}