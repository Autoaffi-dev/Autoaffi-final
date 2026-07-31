import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type ContactTemperature = "cold" | "warm" | "hot";

type SupabaseAdminClient = any;

type ContactManagerActivity = {
  id: string;
  user_id: string;
  contact_manager_item_id: string;

  activity_type: string;
  title: string;
  description: string | null;

  previous_status: string | null;
  new_status: string | null;

  message_snapshot: string | null;
  notes_snapshot: string | null;

  next_follow_up_at: string | null;

  meta: Record<string, any>;

  created_at: string;
};

type ContactManagerItem = {
  id: string;
  user_id: string;

  source_type: string;
  source_record_id: string;
  source_label: string | null;
  source_url: string | null;

  name: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;

  temperature: ContactTemperature;
  status: ContactStatus;

  next_step: string | null;
  suggested_opener: string | null;
  notes: string | null;

  last_touch_at: string | null;
  next_follow_up_at: string | null;

  is_archived: boolean;
  is_won: boolean;
  is_lost: boolean;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;

  meta: Record<string, any>;

  created_at: string;
  updated_at: string;

  activities: ContactManagerActivity[];
};

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;

  const cleaned = sanitizeHeaderId(String(value));

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    cleaned
  );
}

async function getEffectiveUserId(req: Request) {
  try {
    return await requireUserId(req);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UNAUTHORIZED");
    }

    const headerUserId = sanitizeHeaderId(
      req.headers.get("x-autoaffi-user-id") || ""
    );

    const devUserId = sanitizeHeaderId(
      (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim() ||
        (process.env.DEV_USER_ID || "").trim() ||
        (process.env.AUTOAFFI_DEV_USER_ID || "").trim()
    );

    if (isUuid(headerUserId)) return headerUserId;
    if (isUuid(devUserId)) return devUserId;

    throw new Error("UNAUTHORIZED");
  }
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeTemperature(value: unknown): ContactTemperature {
  const raw = asString(value).toLowerCase();

  if (raw === "hot") return "hot";
  if (raw === "warm") return "warm";

  return "cold";
}

function normalizeStatus(value: unknown): ContactStatus {
  const raw = asString(value).toLowerCase();

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

function sourceDisplayName(sourceType: string, fallback?: string | null) {
  if (fallback) return fallback;

  switch (sourceType) {
    case "social-lead-engine":
      return "Social Lead Engine";
    case "business-finder":
      return "Business Finder";
    case "qr-leads":
      return "QR Leads";
    case "tracking-id-engine":
      return "Tracking ID Engine";
    case "gpt-store":
      return "GPT Store Lead";
    case "mlgs":
      return "MLGS";
    case "manual":
      return "Manual";
    default:
      return "Contact Manager";
  }
}

function displayTitle(row: any) {
  return (
    asString(row.title) ||
    asString(row.name) ||
    asString(row.email) ||
    asString(row.phone) ||
    "Untitled contact"
  );
}

function displayDescription(row: any) {
  return (
    asString(row.description) ||
    asString(row.next_step) ||
    asString(row.suggested_opener) ||
    "No extra context yet."
  );
}

function normalizeActivity(row: any): ContactManagerActivity {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    contact_manager_item_id: String(row.contact_manager_item_id),

    activity_type: asString(row.activity_type, "system"),
    title: asString(row.title, "Activity"),
    description: row.description || null,

    previous_status: row.previous_status || null,
    new_status: row.new_status || null,

    message_snapshot: row.message_snapshot || null,
    notes_snapshot: row.notes_snapshot || null,

    next_follow_up_at: row.next_follow_up_at || null,

    meta: row.meta || {},

    created_at: row.created_at,
  };
}

function normalizeContact(
  row: any,
  activities: ContactManagerActivity[]
): ContactManagerItem {
  const sourceType = asString(row.source_type, "manual");
  const sourceLabel = sourceDisplayName(sourceType, row.source_label);

  return {
    id: String(row.id),
    user_id: String(row.user_id),

    source_type: sourceType,
    source_record_id: asString(row.source_record_id),
    source_label: sourceLabel,
    source_url: row.source_url || null,

    name: row.name || null,
    title: displayTitle(row),
    description: displayDescription(row),
    email: row.email || null,
    phone: row.phone || null,

    temperature: normalizeTemperature(row.temperature),
    status: normalizeStatus(row.status),

    next_step: row.next_step || null,
    suggested_opener: row.suggested_opener || null,
    notes: row.notes || null,

    last_touch_at: row.last_touch_at || null,
    next_follow_up_at: row.next_follow_up_at || null,

    is_archived: Boolean(row.is_archived),
    is_won: Boolean(row.is_won),
    is_lost: Boolean(row.is_lost),
    do_not_contact: Boolean(row.do_not_contact),
    do_not_contact_reason: row.do_not_contact_reason || null,

    meta: row.meta || {},

    created_at: row.created_at,
    updated_at: row.updated_at,

    activities,
  };
}

function countBy(items: ContactManagerItem[], status: ContactStatus) {
  return items.filter((item) => item.status === status).length;
}

function countTemperature(
  items: ContactManagerItem[],
  temperature: ContactTemperature
) {
  return items.filter((item) => item.temperature === temperature).length;
}

function groupBySource(items: ContactManagerItem[]) {
  const map = new Map<
    string,
    {
      sourceType: string;
      sourceLabel: string;
      count: number;
      hot: number;
      warm: number;
      cold: number;
    }
  >();

  for (const item of items) {
    const existing =
      map.get(item.source_type) ||
      ({
        sourceType: item.source_type,
        sourceLabel: item.source_label || sourceDisplayName(item.source_type),
        count: 0,
        hot: 0,
        warm: 0,
        cold: 0,
      } satisfies {
        sourceType: string;
        sourceLabel: string;
        count: number;
        hot: number;
        warm: number;
        cold: number;
      });

    existing.count += 1;

    if (item.temperature === "hot") existing.hot += 1;
    if (item.temperature === "warm") existing.warm += 1;
    if (item.temperature === "cold") existing.cold += 1;

    map.set(item.source_type, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function groupPipeline(items: ContactManagerItem[]) {
  return {
    new: items.filter((item) => item.status === "new"),
    saved: items.filter((item) => item.status === "saved"),
    contacted: items.filter((item) => item.status === "contacted"),
    replied: items.filter((item) => item.status === "replied"),
    interested: items.filter((item) => item.status === "interested"),
    follow_up: items.filter((item) => item.status === "follow_up"),
    no_answer: items.filter((item) => item.status === "no_answer"),
    stop_contact: items.filter(
      (item) => item.status === "stop_contact" || item.do_not_contact
    ),
    successful: items.filter(
      (item) => item.status === "successful" || item.status === "won"
    ),
    won: items.filter((item) => item.status === "won"),
    lost: items.filter((item) => item.status === "lost"),
    archived: items.filter((item) => item.status === "archived"),
  };
}

function buildTabCounts(items: ContactManagerItem[]) {
  return {
    new_leads: items.filter(
      (item) => item.status === "new" || item.status === "saved"
    ).length,
    contacted: items.filter((item) => item.status === "contacted").length,
    follow_up: items.filter((item) => item.status === "follow_up").length,
    replied_interested: items.filter(
      (item) => item.status === "replied" || item.status === "interested"
    ).length,
    no_answer: items.filter((item) => item.status === "no_answer").length,
    stop_contact: items.filter(
      (item) => item.status === "stop_contact" || item.do_not_contact
    ).length,
    successful: items.filter(
      (item) => item.status === "successful" || item.status === "won"
    ).length,
  };
}

export async function GET(req: Request) {
  try {
    const userId = await getEffectiveUserId(req);
    const supabase = getSupabaseAdmin() as SupabaseAdminClient;

    const url = new URL(req.url);

    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const statusFilter = asString(url.searchParams.get("status"));
    const temperatureFilter = asString(url.searchParams.get("temperature"));
    const sourceTypeFilter = asString(url.searchParams.get("sourceType"));

    let query = supabase
      .from("contact_manager_items")
      .select(
        [
          "id",
          "user_id",
          "source_type",
          "source_record_id",
          "source_label",
          "source_url",
          "name",
          "title",
          "description",
          "email",
          "phone",
          "temperature",
          "status",
          "next_step",
          "suggested_opener",
          "notes",
          "last_touch_at",
          "next_follow_up_at",
          "is_archived",
          "is_won",
          "is_lost",
          "do_not_contact",
          "do_not_contact_reason",
          "meta",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (temperatureFilter) {
      query = query.eq("temperature", temperatureFilter);
    }

    if (sourceTypeFilter) {
      query = query.eq("source_type", sourceTypeFilter);
    }

    const { data, error } = await query;

    if (error) {
      return jsonError(500, {
        ok: false,
        error: "CONTACT_MANAGER_OVERVIEW_FAILED",
        details: error.message,
      });
    }

    const rawRows = data || [];
    const itemIds = rawRows.map((row: any) => String(row.id)).filter(Boolean);

    let activitiesByItem = new Map<string, ContactManagerActivity[]>();

    if (itemIds.length > 0) {
      const { data: activityRows, error: activityError } = await supabase
        .from("contact_manager_activity_log")
        .select(
          [
            "id",
            "user_id",
            "contact_manager_item_id",
            "activity_type",
            "title",
            "description",
            "previous_status",
            "new_status",
            "message_snapshot",
            "notes_snapshot",
            "next_follow_up_at",
            "meta",
            "created_at",
          ].join(",")
        )
        .eq("user_id", userId)
        .in("contact_manager_item_id", itemIds)
        .order("created_at", { ascending: false });

      if (activityError) {
        return jsonError(500, {
          ok: false,
          error: "CONTACT_MANAGER_ACTIVITY_LOG_FAILED",
          details: activityError.message,
        });
      }

      for (const row of activityRows || []) {
        const activity = normalizeActivity(row);
        const current =
          activitiesByItem.get(activity.contact_manager_item_id) || [];

        current.push(activity);
        activitiesByItem.set(activity.contact_manager_item_id, current);
      }
    }

    const items = rawRows.map((row: any) =>
      normalizeContact(row, activitiesByItem.get(String(row.id)) || [])
    );

    const activeItems = items.filter((item) => !item.is_archived);
    const pipeline = groupPipeline(items);
    const tabCounts = buildTabCounts(activeItems);

    return NextResponse.json({
      ok: true,
      mode: "live",
      userId,
      count: items.length,
      counts: {
        all: items.length,

        new: countBy(items, "new"),
        saved: countBy(items, "saved"),
        contacted: countBy(items, "contacted"),
        replied: countBy(items, "replied"),
        interested: countBy(items, "interested"),
        follow_up: countBy(items, "follow_up"),
        no_answer: countBy(items, "no_answer"),
        stop_contact: items.filter(
          (item) => item.status === "stop_contact" || item.do_not_contact
        ).length,
        successful: items.filter(
          (item) => item.status === "successful" || item.status === "won"
        ).length,
        won: countBy(items, "won"),
        lost: countBy(items, "lost"),
        archived: countBy(items, "archived"),

        hot: countTemperature(items, "hot"),
        warm: countTemperature(items, "warm"),
        cold: countTemperature(items, "cold"),

        active: activeItems.length,
        doNotContact: items.filter((item) => item.do_not_contact).length,
        needsFollowUp: items.filter(
          (item) =>
            item.next_follow_up_at &&
            new Date(item.next_follow_up_at).getTime() <= Date.now()
        ).length,
      },
      bySource: groupBySource(items),
      tabCounts,
      pipeline,
      items,
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;

    return jsonError(status, {
      ok: false,
      error: msg,
    });
  }
}