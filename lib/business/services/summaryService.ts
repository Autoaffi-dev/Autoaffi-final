import { getSupabaseAdmin } from "@/lib/supabase/server";

type PipelineTargetRow = {
  id: string;
  source: string | null;
  source_id: string | null;
  name: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  domain: string | null;
  size_hint: string | null;
};

type PipelineRow = {
  id: string;
  target_id: string | null;
  status: string | null;
  score: number | null;
  why: unknown;
  contact_strategy: string | null;
  created_at: string | null;
  updated_at: string | null;
  business_targets: PipelineTargetRow | PipelineTargetRow[] | null;
};

type EventRow = {
  id: string;
  target_id: string | null;
  event_type: string | null;
  channel: string | null;
  created_at: string | null;
  meta: Record<string, any> | null;
};

type WinRow = {
  target_id: string | null;
  user_id: string | null;
  campaign_id: string | null;
  won_at: string | null;
};

type SummaryRecentLead = {
  pipelineId: string;
  targetId: string | null;
  status: string | null;
  score: number;
  why: string[];
  contactStrategy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  target: {
    id: string;
    source: string | null;
    sourceId: string | null;
    name: string | null;
    country: string | null;
    city: string | null;
    category: string | null;
    website: string | null;
    phone: string | null;
    rating: number | null;
    domain: string | null;
    sizeHint: string | null;
  } | null;
};

type SummaryActionItem = {
  type: "needs_follow_up" | "needs_reply_handling" | "recent_win";
  priority: "high" | "medium" | "low";
  targetId: string | null;
  pipelineId: string | null;
  title: string;
  description: string;
  status: string | null;
  eventType: string | null;
  eventAt: string | null;
};

export type BusinessSummary = {
  stats: {
    totalPipeline: number;
    claimed: number;
    won: number;
    suppressed: number;
    cooldown: number;
    hot: number;
    warm: number;
    cold: number;
    newLeadsToday: number;
  };
  activity: {
    lastEventType: string | null;
    lastEventAt: string | null;
  };
  focus: {
    needsFollowUp: number;
    needsReplyHandling: number;
    recentWins: number;
  };
  recentPipeline: SummaryRecentLead[];
  actionItems: SummaryActionItem[];
};

function normalizeScore(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeWhy(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function startOfTodayMs() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function isWithinLastDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function hasReplyLikeEvent(eventType: string | null | undefined) {
  return eventType === "reply";
}

function hasStopLikeEvent(eventType: string | null | undefined) {
  return eventType === "no" || eventType === "stop";
}

function hasActionableClaimStatus(status: string | null | undefined) {
  return status === "CLAIMED";
}

function isClosedOrBlockedStatus(status: string | null | undefined) {
  return status === "WON" || status === "SUPPRESSED" || status === "COOLDOWN";
}

function sortByDateDesc<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined
) {
  return [...items].sort((a, b) => {
    const aTs = new Date(getDate(a) ?? 0).getTime();
    const bTs = new Date(getDate(b) ?? 0).getTime();
    const safeA = Number.isFinite(aTs) ? aTs : 0;
    const safeB = Number.isFinite(bTs) ? bTs : 0;
    return safeB - safeA;
  });
}

function normalizeBusinessTarget(value: PipelineRow["business_targets"]) {
  const target = Array.isArray(value) ? value[0] ?? null : value;
  if (!target) return null;

  return {
    id: String(target.id ?? ""),
    source: target.source ?? null,
    sourceId: target.source_id ?? null,
    name: target.name ?? null,
    country: target.country ?? null,
    city: target.city ?? null,
    category: target.category ?? null,
    website: target.website ?? null,
    phone: target.phone ?? null,
    rating:
      typeof target.rating === "number" && Number.isFinite(target.rating)
        ? target.rating
        : null,
    domain: target.domain ?? null,
    sizeHint: target.size_hint ?? null,
  };
}

export async function getBusinessSummary(userId: string): Promise<BusinessSummary> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }

  const supabase = getSupabaseAdmin();
  const todayStartMs = startOfTodayMs();

  const [pipelineRes, eventsRes, winsRes] = await Promise.all([
    supabase
      .from("business_pipeline")
      .select(`
        id,
        target_id,
        status,
        score,
        why,
        contact_strategy,
        created_at,
        updated_at,
        business_targets:target_id (
          id,
          source,
          source_id,
          name,
          country,
          city,
          category,
          website,
          phone,
          rating,
          domain,
          size_hint
        )
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),

    supabase
      .from("business_events")
      .select("id, target_id, event_type, channel, created_at, meta")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),

    supabase
      .from("business_wins")
      .select("target_id, user_id, campaign_id, won_at")
      .eq("user_id", userId)
      .order("won_at", { ascending: false })
      .limit(50),
  ]);

  if (pipelineRes.error) {
    throw new Error(`Failed to load pipeline summary: ${pipelineRes.error.message}`);
  }

  if (eventsRes.error) {
    throw new Error(`Failed to load event summary: ${eventsRes.error.message}`);
  }

  if (winsRes.error) {
    throw new Error(`Failed to load wins summary: ${winsRes.error.message}`);
  }

  const pipelineRows = ((pipelineRes.data ?? []) as unknown[]) as PipelineRow[];
  const eventRows = ((eventsRes.data ?? []) as unknown[]) as EventRow[];
  const winRows = ((winsRes.data ?? []) as unknown[]) as WinRow[];

  const claimed = pipelineRows.filter((r) => r.status === "CLAIMED").length;
  const suppressed = pipelineRows.filter((r) => r.status === "SUPPRESSED").length;
  const cooldown = pipelineRows.filter((r) => r.status === "COOLDOWN").length;
  const won = pipelineRows.filter((r) => r.status === "WON").length;

  const hot = pipelineRows.filter((r) => normalizeScore(r.score) >= 10).length;
  const warm = pipelineRows.filter((r) => {
    const s = normalizeScore(r.score);
    return s >= 6 && s <= 9;
  }).length;
  const cold = pipelineRows.filter((r) => normalizeScore(r.score) <= 5).length;

  const newLeadsToday = pipelineRows.filter((r) => {
    if (!r.created_at) return false;
    const createdMs = new Date(r.created_at).getTime();
    return Number.isFinite(createdMs) && createdMs >= todayStartMs;
  }).length;

  const lastEvent = eventRows[0] ?? null;

  const latestEventByTarget = new Map<string, EventRow>();
  for (const event of eventRows) {
    if (!event.target_id) continue;
    if (!latestEventByTarget.has(event.target_id)) {
      latestEventByTarget.set(event.target_id, event);
    }
  }

  const recentPipeline: SummaryRecentLead[] = pipelineRows.slice(0, 5).map((row) => ({
    pipelineId: row.id,
    targetId: row.target_id,
    status: row.status,
    score: normalizeScore(row.score),
    why: normalizeWhy(row.why),
    contactStrategy: row.contact_strategy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    target: normalizeBusinessTarget(row.business_targets),
  }));

  const followUpCandidates = pipelineRows.filter((row) => {
    if (!row.target_id) return false;
    if (!hasActionableClaimStatus(row.status)) return false;
    if (isClosedOrBlockedStatus(row.status)) return false;

    const latestEvent = latestEventByTarget.get(row.target_id);
    if (!latestEvent) return true;

    if (hasReplyLikeEvent(latestEvent.event_type)) return false;
    if (hasStopLikeEvent(latestEvent.event_type)) return false;

    return isWithinLastDays(latestEvent.created_at, 7);
  });

  const replyHandlingCandidates = pipelineRows.filter((row) => {
    if (!row.target_id) return false;
    if (isClosedOrBlockedStatus(row.status)) return false;

    const latestEvent = latestEventByTarget.get(row.target_id);
    if (!latestEvent) return false;

    return hasReplyLikeEvent(latestEvent.event_type);
  });

  const recentWins = winRows.filter((row) => isWithinLastDays(row.won_at, 7)).length;

  const actionItems: SummaryActionItem[] = [];

  for (const row of followUpCandidates.slice(0, 3)) {
    const target = normalizeBusinessTarget(row.business_targets);
    const name = target?.name ?? "Lead";
    const latestEvent = row.target_id ? latestEventByTarget.get(row.target_id) : undefined;

    actionItems.push({
      type: "needs_follow_up",
      priority: "medium",
      targetId: row.target_id,
      pipelineId: row.id,
      title: `Follow up with ${name}`,
      description: latestEvent
        ? `Last event was ${latestEvent.event_type ?? "activity"}${
            latestEvent.created_at ? ` on ${latestEvent.created_at}` : ""
          }.`
        : "No reply has been logged yet. This lead may need a follow-up.",
      status: row.status,
      eventType: latestEvent?.event_type ?? null,
      eventAt: latestEvent?.created_at ?? null,
    });
  }

  for (const row of replyHandlingCandidates.slice(0, 3)) {
    const target = normalizeBusinessTarget(row.business_targets);
    const name = target?.name ?? "Lead";
    const latestEvent = row.target_id ? latestEventByTarget.get(row.target_id) : undefined;

    actionItems.push({
      type: "needs_reply_handling",
      priority: "high",
      targetId: row.target_id,
      pipelineId: row.id,
      title: `Handle reply from ${name}`,
      description: "A reply has been logged and should be reviewed quickly.",
      status: row.status,
      eventType: latestEvent?.event_type ?? null,
      eventAt: latestEvent?.created_at ?? null,
    });
  }

  for (const row of sortByDateDesc(winRows, (x) => x.won_at).slice(0, 2)) {
    const pipeline = pipelineRows.find((p) => p.target_id === row.target_id);
    const target = pipeline ? normalizeBusinessTarget(pipeline.business_targets) : null;
    const name = target?.name ?? "Lead";

    actionItems.push({
      type: "recent_win",
      priority: "low",
      targetId: row.target_id,
      pipelineId: pipeline?.id ?? null,
      title: `Recent win: ${name}`,
      description: "This lead has recently been marked as won.",
      status: pipeline?.status ?? "WON",
      eventType: "won",
      eventAt: row.won_at ?? null,
    });
  }

  return {
    stats: {
      totalPipeline: pipelineRows.length,
      claimed,
      won,
      suppressed,
      cooldown,
      hot,
      warm,
      cold,
      newLeadsToday,
    },
    activity: {
      lastEventType: lastEvent?.event_type ?? null,
      lastEventAt: lastEvent?.created_at ?? null,
    },
    focus: {
      needsFollowUp: followUpCandidates.length,
      needsReplyHandling: replyHandlingCandidates.length,
      recentWins,
    },
    recentPipeline,
    actionItems: sortByDateDesc(actionItems, (x) => x.eventAt).slice(0, 8),
  };
}