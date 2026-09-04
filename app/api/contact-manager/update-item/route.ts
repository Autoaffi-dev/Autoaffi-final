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

type ActivityType =
  | "created"
  | "message_saved"
  | "email_sent"
  | "status_changed"
  | "follow_up_set"
  | "follow_up_completed"
  | "no_answer_marked"
  | "replied_marked"
  | "interested_marked"
  | "stop_contact_marked"
  | "successful_marked"
  | "lost_marked"
  | "archived"
  | "notes_updated"
  | "manual_note"
  | "system";

type SupabaseAdminClient = any;

type UpdateBody = {
  id?: string;
  status?: ContactStatus;
  temperature?: ContactTemperature;
  notes?: string | null;
  next_step?: string | null;
  suggested_opener?: string | null;
  next_follow_up_at?: string | null;
  do_not_contact_reason?: string | null;
};

const ALLOWED_STATUSES: ContactStatus[] = [
  "new",
  "saved",
  "contacted",
  "replied",
  "interested",
  "follow_up",
  "no_answer",
  "stop_contact",
  "successful",
  "won",
  "lost",
  "archived",
];

const ALLOWED_TEMPERATURES: ContactTemperature[] = ["cold", "warm", "hot"];

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

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeStatus(value: unknown): ContactStatus | null {
  const raw = asString(value).toLowerCase() as ContactStatus;

  if (ALLOWED_STATUSES.includes(raw)) return raw;

  return null;
}

function normalizeTemperature(value: unknown): ContactTemperature | null {
  const raw = asString(value).toLowerCase() as ContactTemperature;

  if (ALLOWED_TEMPERATURES.includes(raw)) return raw;

  return null;
}

function normalizeNullableText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = asString(value);
  return text || null;
}

function normalizeDateOrNull(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_NEXT_FOLLOW_UP_AT");
  }

  return date.toISOString();
}

function getAutomaticFieldsForStatus(status: ContactStatus) {
  const now = new Date().toISOString();

  const updates: Record<string, any> = {};

  if (status === "contacted") {
    updates.last_touch_at = now;
    updates.is_archived = false;
    updates.is_won = false;
    updates.is_lost = false;
    updates.do_not_contact = false;
    updates.do_not_contact_reason = null;
  }

  if (status === "replied") {
    updates.last_touch_at = now;
    updates.is_archived = false;
    updates.is_lost = false;
  }

  if (status === "interested") {
    updates.last_touch_at = now;
    updates.is_archived = false;
    updates.is_lost = false;
  }

  if (status === "follow_up") {
    updates.is_archived = false;
    updates.is_lost = false;
  }

  if (status === "no_answer") {
    updates.last_touch_at = now;
    updates.is_archived = false;
    updates.is_won = false;
    updates.is_lost = false;
  }

  if (status === "stop_contact") {
    updates.last_touch_at = now;
    updates.do_not_contact = true;
    updates.is_lost = true;
    updates.is_won = false;
    updates.next_follow_up_at = null;
  }

  if (status === "successful" || status === "won") {
    updates.last_touch_at = now;
    updates.is_won = true;
    updates.is_lost = false;
    updates.is_archived = false;
    updates.do_not_contact = false;
    updates.do_not_contact_reason = null;
  }

  if (status === "lost") {
    updates.last_touch_at = now;
    updates.is_lost = true;
    updates.is_won = false;
  }

  if (status === "archived") {
    updates.is_archived = true;
  }

  if (status === "new" || status === "saved") {
    updates.is_archived = false;
  }

  return updates;
}

function getActivityForStatus(status: ContactStatus): {
  activity_type: ActivityType;
  title: string;
  description: string;
} {
  if (status === "contacted") {
    return {
      activity_type: "message_saved",
      title: "Message saved as contacted",
      description:
        "The lead was marked as contacted. If Gmail is not connected, this means the outreach was saved manually.",
    };
  }

  if (status === "replied") {
    return {
      activity_type: "replied_marked",
      title: "Lead marked as replied",
      description:
        "The lead was manually marked as having replied or responded.",
    };
  }

  if (status === "interested") {
    return {
      activity_type: "interested_marked",
      title: "Lead marked as interested",
      description:
        "The lead was manually marked as interested or showing buying intent.",
    };
  }

  if (status === "follow_up") {
    return {
      activity_type: "follow_up_set",
      title: "Follow-up reminder set",
      description:
        "The lead was moved to follow-up so the customer can handle it as a task.",
    };
  }

  if (status === "no_answer") {
    return {
      activity_type: "no_answer_marked",
      title: "No answer marked",
      description:
        "The lead was manually marked as no answer after previous contact.",
    };
  }

  if (status === "stop_contact") {
    return {
      activity_type: "stop_contact_marked",
      title: "Stop contact marked",
      description:
        "The lead should not be contacted again unless the customer manually changes the status.",
    };
  }

  if (status === "successful" || status === "won") {
    return {
      activity_type: "successful_marked",
      title: "Successful lead marked",
      description:
        "The lead was marked as successful. A support follow-up is recommended.",
    };
  }

  if (status === "lost") {
    return {
      activity_type: "lost_marked",
      title: "Lead marked as lost",
      description: "The lead was marked as lost or no longer relevant.",
    };
  }

  if (status === "archived") {
    return {
      activity_type: "archived",
      title: "Lead archived",
      description: "The lead was archived from the active Contact Manager view.",
    };
  }

  return {
    activity_type: "status_changed",
    title: "Status changed",
    description: `Lead status changed to ${status}.`,
  };
}

function buildActivityPayload(args: {
  userId: string;
  itemId: string;
  previousStatus: ContactStatus | string | null;
  newStatus?: ContactStatus;
  notes?: string | null | undefined;
  suggestedOpener?: string | null | undefined;
  nextFollowUpAt?: string | null | undefined;
  updatePayload: Record<string, any>;
}) {
  const {
    userId,
    itemId,
    previousStatus,
    newStatus,
    notes,
    suggestedOpener,
    nextFollowUpAt,
    updatePayload,
  } = args;

  if (newStatus) {
    const activity = getActivityForStatus(newStatus);

    return {
      user_id: userId,
      contact_manager_item_id: itemId,
      activity_type: activity.activity_type,
      title: activity.title,
      description: activity.description,
      previous_status: previousStatus,
      new_status: newStatus,
      message_snapshot:
        suggestedOpener !== undefined ? suggestedOpener : updatePayload.suggested_opener ?? null,
      notes_snapshot:
        notes !== undefined ? notes : updatePayload.notes ?? null,
      next_follow_up_at:
        nextFollowUpAt !== undefined
          ? nextFollowUpAt
          : updatePayload.next_follow_up_at ?? null,
      meta: {
        automatic: true,
        source: "contact_manager_update_item",
      },
    };
  }

  if (notes !== undefined) {
    return {
      user_id: userId,
      contact_manager_item_id: itemId,
      activity_type: "notes_updated",
      title: "Notes updated",
      description: "Private notes were updated for this lead.",
      previous_status: previousStatus,
      new_status: previousStatus,
      message_snapshot: updatePayload.suggested_opener ?? null,
      notes_snapshot: notes,
      next_follow_up_at: updatePayload.next_follow_up_at ?? null,
      meta: {
        automatic: true,
        source: "contact_manager_update_item",
      },
    };
  }

  return {
    user_id: userId,
    contact_manager_item_id: itemId,
    activity_type: "system",
    title: "Lead updated",
    description: "The lead was updated in Contact Manager.",
    previous_status: previousStatus,
    new_status: previousStatus,
    message_snapshot: updatePayload.suggested_opener ?? null,
    notes_snapshot: updatePayload.notes ?? null,
    next_follow_up_at: updatePayload.next_follow_up_at ?? null,
    meta: {
      automatic: true,
      source: "contact_manager_update_item",
    },
  };
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin() as SupabaseAdminClient;

    const body = (await req.json().catch(() => null)) as UpdateBody | null;

    if (!body) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_BODY",
      });
    }

    const id = asString(body.id);

    if (!isUuid(id)) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_CONTACT_MANAGER_ITEM_ID",
      });
    }

    const updatePayload: Record<string, any> = {};

    const status =
      body.status !== undefined ? normalizeStatus(body.status) : undefined;

    if (body.status !== undefined && !status) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_STATUS",
        allowed: ALLOWED_STATUSES,
      });
    }

    if (status) {
      updatePayload.status = status;

      Object.assign(updatePayload, getAutomaticFieldsForStatus(status));

      if (status === "stop_contact") {
        updatePayload.do_not_contact_reason =
          normalizeNullableText(body.do_not_contact_reason) ||
          "Lead requested no further contact.";
      }

      if (status === "successful" || status === "won") {
        updatePayload.next_step =
          normalizeNullableText(body.next_step) ||
          "Send a helpful support message and offer guidance if they have questions.";
      }
    }

    const temperature =
      body.temperature !== undefined
        ? normalizeTemperature(body.temperature)
        : undefined;

    if (body.temperature !== undefined && !temperature) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_TEMPERATURE",
        allowed: ALLOWED_TEMPERATURES,
      });
    }

    if (temperature) {
      updatePayload.temperature = temperature;
    }

    const notes = normalizeNullableText(body.notes);
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const nextStep = normalizeNullableText(body.next_step);
    if (nextStep !== undefined) {
      updatePayload.next_step = nextStep;
    }

    const suggestedOpener = normalizeNullableText(body.suggested_opener);
    if (suggestedOpener !== undefined) {
      updatePayload.suggested_opener = suggestedOpener;
    }

    const nextFollowUpAt = normalizeDateOrNull(body.next_follow_up_at);
    if (nextFollowUpAt !== undefined) {
      updatePayload.next_follow_up_at = nextFollowUpAt;
    }

    const doNotContactReason = normalizeNullableText(
      body.do_not_contact_reason
    );
    if (
      doNotContactReason !== undefined &&
      updatePayload.status !== "stop_contact"
    ) {
      updatePayload.do_not_contact_reason = doNotContactReason;
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonError(400, {
        ok: false,
        error: "NO_UPDATE_FIELDS",
      });
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("contact_manager_items")
      .select("id,user_id,status,temperature,do_not_contact")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      return jsonError(500, {
        ok: false,
        error: "CONTACT_MANAGER_LOOKUP_FAILED",
        details: existingError.message,
      });
    }

    if (!existingItem) {
      return jsonError(404, {
        ok: false,
        error: "CONTACT_MANAGER_ITEM_NOT_FOUND",
      });
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("contact_manager_items")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      return jsonError(500, {
        ok: false,
        error: "CONTACT_MANAGER_UPDATE_FAILED",
        details: updateError.message,
      });
    }

    const activityPayload = buildActivityPayload({
      userId,
      itemId: id,
      previousStatus: existingItem.status,
      newStatus: status || undefined,
      notes,
      suggestedOpener,
      nextFollowUpAt,
      updatePayload,
    });

    const { data: activityLog, error: activityError } = await supabase
      .from("contact_manager_activity_log")
      .insert(activityPayload)
      .select("*")
      .single();

    if (activityError) {
      return NextResponse.json({
        ok: true,
        warning: "Contact Manager item updated, but activity log failed.",
        activityError: activityError.message,
        item: updatedItem,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Contact Manager item updated.",
      item: updatedItem,
      activity: activityLog,
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";

    const status =
      msg === "UNAUTHORIZED"
        ? 401
        : msg === "INVALID_NEXT_FOLLOW_UP_AT"
          ? 400
          : 500;

    return jsonError(status, {
      ok: false,
      error: msg,
    });
  }
}