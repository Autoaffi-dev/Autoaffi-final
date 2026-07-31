import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactTemperature = "cold" | "warm" | "hot";

type ContactStatus =
  | "new"
  | "saved"
  | "contacted"
  | "replied"
  | "interested"
  | "follow_up"
  | "no_answer"
  | "stop_contact"
  | "successful"
  | "won"
  | "lost"
  | "archived";

type ContactManagerItemRow = {
  id: string;
  user_id: string;
  source_type: string | null;
  source_label: string | null;
  name: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  temperature: ContactTemperature | null;
  status: ContactStatus | null;
  next_step: string | null;
  last_touch_at: string | null;
  next_follow_up_at: string | null;
  is_archived: boolean | null;
  is_won: boolean | null;
  is_lost: boolean | null;
  do_not_contact: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type DailyBriefPayload = {
  userId: string;
  briefDate: string;
  title: string;
  summary: string;
  priorityFocus: string;
  manualLeadTask: string;
  warning: string;
  successTask: string;
  hotLeadIds: string[];
  warmLeadIds: string[];
  followUpLeadIds: string[];
  noAnswerLeadIds: string[];
  successfulLeadIds: string[];
  planItems: Array<{
    type: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>;
  messageSuggestions: {
    firstContact: string;
    followUp: string;
    noAnswer: string;
    successful: string;
  };
  meta: Record<string, any>;
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown): ContactStatus {
  const raw = String(value || "").toLowerCase();

  if (
    raw === "new" ||
    raw === "saved" ||
    raw === "contacted" ||
    raw === "replied" ||
    raw === "interested" ||
    raw === "follow_up" ||
    raw === "no_answer" ||
    raw === "stop_contact" ||
    raw === "successful" ||
    raw === "won" ||
    raw === "lost" ||
    raw === "archived"
  ) {
    return raw;
  }

  return "new";
}

function normalizeTemperature(value: unknown): ContactTemperature {
  const raw = String(value || "").toLowerCase();

  if (raw === "hot" || raw === "warm" || raw === "cold") {
    return raw;
  }

  return "cold";
}

function isDueToday(value: string | null | undefined) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) return false;

  return timestamp <= Date.now();
}

function getLeadName(item: ContactManagerItemRow) {
  return (
    item.name ||
    item.title ||
    item.email ||
    item.source_label ||
    "Unnamed lead"
  );
}

function uniqueIds(items: ContactManagerItemRow[]) {
  return Array.from(new Set(items.map((item) => item.id).filter(Boolean)));
}

function pickTop(items: ContactManagerItemRow[], limit: number) {
  return items
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();

      return bTime - aTime;
    })
    .slice(0, limit);
}

function buildManualLeadTask(args: {
  hotCount: number;
  warmCount: number;
  followUpCount: number;
}) {
  if (args.hotCount === 0 && args.warmCount === 0) {
    return "Find 3 new manual leads today from comments, Reddit threads, Facebook groups or niche communities where people ask about affiliate marketing, content creation, traffic, AI tools or side income.";
  }

  if (args.followUpCount > 0) {
    return "After handling today’s follow-ups, find 1–2 new high-quality manual leads. Focus on people already asking for help, not cold random profiles.";
  }

  return "Add 2 new manual leads today from places where people are already asking about content, affiliate marketing, online business or getting more traffic.";
}

function buildDailyBriefForUser(
  userId: string,
  items: ContactManagerItemRow[],
  briefDate: string
): DailyBriefPayload {
  const active = items.filter(
    (item) =>
      item.user_id === userId &&
      item.is_archived !== true &&
      item.do_not_contact !== true &&
      normalizeStatus(item.status) !== "stop_contact" &&
      normalizeStatus(item.status) !== "archived" &&
      normalizeStatus(item.status) !== "lost"
  );

  const hotNew = pickTop(
    active.filter(
      (item) =>
        normalizeTemperature(item.temperature) === "hot" &&
        (normalizeStatus(item.status) === "new" ||
          normalizeStatus(item.status) === "saved")
    ),
    5
  );

  const warmNew = pickTop(
    active.filter(
      (item) =>
        normalizeTemperature(item.temperature) === "warm" &&
        (normalizeStatus(item.status) === "new" ||
          normalizeStatus(item.status) === "saved")
    ),
    5
  );

  const followUps = pickTop(
    active.filter(
      (item) =>
        normalizeStatus(item.status) === "follow_up" ||
        isDueToday(item.next_follow_up_at)
    ),
    5
  );

  const noAnswer = pickTop(
    active.filter((item) => normalizeStatus(item.status) === "no_answer"),
    5
  );

  const successful = pickTop(
    active.filter(
      (item) =>
        normalizeStatus(item.status) === "successful" ||
        normalizeStatus(item.status) === "won" ||
        item.is_won === true
    ),
    5
  );

  const planItems: DailyBriefPayload["planItems"] = [];

  if (hotNew.length > 0) {
    planItems.push({
      type: "hot_leads",
      title: `Contact ${hotNew.length} hot lead${
        hotNew.length === 1 ? "" : "s"
      } first`,
      description: `Start with: ${hotNew
        .map(getLeadName)
        .slice(0, 3)
        .join(", ")}. Keep the message personal, short and focused on why Autoaffi is relevant.`,
      priority: "high",
    });
  }

  if (warmNew.length > 0) {
    planItems.push({
      type: "warm_leads",
      title: `Review ${warmNew.length} warm lead${
        warmNew.length === 1 ? "" : "s"
      }`,
      description:
        "Warm leads should be handled after hot leads. Use a soft opener and avoid pushing too hard.",
      priority: "medium",
    });
  }

  if (followUps.length > 0) {
    planItems.push({
      type: "follow_ups",
      title: `Handle ${followUps.length} follow-up${
        followUps.length === 1 ? "" : "s"
      } today`,
      description:
        "Keep follow-ups short. Mention the original reason you reached out and ask one simple question.",
      priority: "high",
    });
  }

  if (noAnswer.length > 0) {
    planItems.push({
      type: "no_answer",
      title: `Review ${noAnswer.length} no-answer lead${
        noAnswer.length === 1 ? "" : "s"
      }`,
      description:
        "Do not chase too hard. Either send one soft final message or leave the lead inactive today.",
      priority: "low",
    });
  }

  if (successful.length > 0) {
    planItems.push({
      type: "successful_support",
      title: `Support ${successful.length} successful lead${
        successful.length === 1 ? "" : "s"
      }`,
      description:
        "A successful lead is not finished. Send helpful guidance so they understand the next step and feel supported.",
      priority: "medium",
    });
  }

  if (planItems.length === 0) {
    planItems.push({
      type: "manual_lead_finding",
      title: "Build today’s pipeline",
      description:
        "No urgent Contact Manager actions today. Find 3 new manual leads from comments, groups, Reddit or niche communities.",
      priority: "medium",
    });
  }

  const priorityFocus =
    hotNew.length > 0
      ? "Start with hot leads. They have the highest chance of becoming a real conversation."
      : followUps.length > 0
        ? "Start with due follow-ups. Keep them short and personal."
        : warmNew.length > 0
          ? "Start by reviewing warm leads and contact only the most relevant ones."
          : "Focus on finding fresh manual leads today.";

  const warning =
    noAnswer.length >= 3
      ? "You have several no-answer leads. Make today’s outreach shorter, calmer and less sales-heavy."
      : "Keep outreach quality-first. Do not send too many messages or too many links.";

  const successTask =
    successful.length > 0
      ? "Send a helpful support message to successful leads. Ask if they need help choosing the next step inside Autoaffi."
      : "When a lead becomes successful, do not stop there. Follow up with support so they get value from Autoaffi.";

  const manualLeadTask = buildManualLeadTask({
    hotCount: hotNew.length,
    warmCount: warmNew.length,
    followUpCount: followUps.length,
  });

  const summary =
    hotNew.length > 0 || followUps.length > 0
      ? "Today has active outreach opportunities. Prioritize quality messages and follow-ups before finding new leads."
      : "Today is a pipeline-building day. Use Contact Manager to create fresh lead opportunities and keep momentum.";

  return {
    userId,
    briefDate,
    title: "Today’s Contact Manager Plan",
    summary,
    priorityFocus,
    manualLeadTask,
    warning,
    successTask,
    hotLeadIds: uniqueIds(hotNew),
    warmLeadIds: uniqueIds(warmNew),
    followUpLeadIds: uniqueIds(followUps),
    noAnswerLeadIds: uniqueIds(noAnswer),
    successfulLeadIds: uniqueIds(successful),
    planItems,
    messageSuggestions: {
      firstContact:
        "Hi [name], I noticed you were looking into [lead situation]. I thought Autoaffi could be relevant because it helps organize content, offers, leads and follow-up in one place. Would you like a quick overview?",
      followUp:
        "Hi [name], just wanted to follow up on my last message. No stress at all — if this is still relevant, I can help you understand the best starting point.",
      noAnswer:
        "Hi [name], just checking in one last time. If this is not relevant right now, no worries at all. Wishing you the best either way.",
      successful:
        "Hi [name], great to see you getting started. If you want help choosing your next step inside Autoaffi, just reply and I’ll guide you.",
    },
    meta: {
      generatedBy: "contact_manager_daily_brief_cron",
      version: "1.0",
      activeLeadCount: active.length,
      hotCount: hotNew.length,
      warmCount: warmNew.length,
      followUpCount: followUps.length,
      noAnswerCount: noAnswer.length,
      successfulCount: successful.length,
    },
  };
}

function isAuthorized(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const expectedSecret =
    process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || "";

  if (!expectedSecret) return false;

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  return bearer === expectedSecret;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHORIZED_CRON",
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const briefDate = getTodayDate();

    const { data: itemsData, error: itemsError } = await supabase
      .from("contact_manager_items")
      .select(
        `
        id,
        user_id,
        source_type,
        source_label,
        name,
        title,
        description,
        email,
        temperature,
        status,
        next_step,
        last_touch_at,
        next_follow_up_at,
        is_archived,
        is_won,
        is_lost,
        do_not_contact,
        created_at,
        updated_at
      `
      )
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (itemsError) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_MANAGER_ITEMS_READ_FAILED",
          details: itemsError.message,
        },
        { status: 500 }
      );
    }

    const items = (itemsData || []) as ContactManagerItemRow[];

    const userIds = Array.from(
      new Set(
        items
          .map((item) => item.user_id)
          .filter((userId): userId is string => Boolean(userId))
      )
    );

    if (userIds.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          mode: "live",
          briefDate,
          generated: 0,
          message: "No Contact Manager users found.",
        },
        { status: 200 }
      );
    }

    const payloads = userIds.map((userId) => {
      const brief = buildDailyBriefForUser(userId, items, briefDate);

      return {
        user_id: brief.userId,
        brief_date: brief.briefDate,
        title: brief.title,
        summary: brief.summary,
        priority_focus: brief.priorityFocus,
        manual_lead_task: brief.manualLeadTask,
        warning: brief.warning,
        success_task: brief.successTask,
        hot_lead_ids: brief.hotLeadIds,
        warm_lead_ids: brief.warmLeadIds,
        follow_up_lead_ids: brief.followUpLeadIds,
        no_answer_lead_ids: brief.noAnswerLeadIds,
        successful_lead_ids: brief.successfulLeadIds,
        plan_items: brief.planItems,
        message_suggestions: brief.messageSuggestions,
        meta: brief.meta,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from("contact_manager_daily_briefs")
      .upsert(payloads, {
        onConflict: "user_id,brief_date",
      });

    if (upsertError) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_MANAGER_DAILY_BRIEF_UPSERT_FAILED",
          details: upsertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        briefDate,
        generated: payloads.length,
        users: userIds.length,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "CONTACT_MANAGER_DAILY_BRIEF_CRON_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}