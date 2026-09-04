import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadTemperature = "cold" | "warm" | "hot";

type SourceId =
  | "social-lead-engine"
  | "business-finder"
  | "qr-leads"
  | "tracking-id-engine";

type SupabaseAdminClient = any;

type ContactManagerPayload = {
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

  temperature: LeadTemperature;
  status: "new" | "saved" | "contacted" | "interested" | "follow_up";

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
};

function jsonError(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeSourceId(value: unknown): SourceId | null {
  const raw = asString(value);

  if (
    raw === "social-lead-engine" ||
    raw === "business-finder" ||
    raw === "qr-leads" ||
    raw === "tracking-id-engine"
  ) {
    return raw;
  }

  return null;
}

function normalizeTemperature(value: unknown): LeadTemperature {
  const raw = asString(value).toLowerCase();

  if (raw === "hot") return "hot";
  if (raw === "warm") return "warm";

  return "cold";
}

function businessTemperature(score: unknown): LeadTemperature {
  const n = typeof score === "number" ? score : Number(score || 0);

  if (n >= 75) return "hot";
  if (n >= 45) return "warm";

  return "cold";
}

function qrTemperature(row: any): LeadTemperature {
  const hasContact =
    Boolean(asString(row?.email)) ||
    Boolean(asString(row?.phone)) ||
    Boolean(asString(row?.message));

  return hasContact ? "hot" : "warm";
}

function safeTitle(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }

  return "Untitled contact";
}

function safeDescription(...values: unknown[]) {
  const parts = values
    .map((value) => asString(value))
    .filter(Boolean)
    .slice(0, 5);

  return parts.length ? parts.join(" · ") : "No extra context yet.";
}

function stripLeadPrefix(leadId: string, sourceId: SourceId) {
  const clean = asString(leadId);

  if (sourceId === "social-lead-engine") {
    return clean.replace(/^social:/, "");
  }

  if (sourceId === "business-finder") {
    return clean.replace(/^business:/, "");
  }

  if (sourceId === "qr-leads") {
    return clean.replace(/^qr:/, "");
  }

  if (sourceId === "tracking-id-engine") {
    return clean.replace(/^tracking:/, "");
  }

  return clean;
}

function sourceLabel(sourceId: SourceId) {
  switch (sourceId) {
    case "social-lead-engine":
      return "Social Lead Engine";
    case "business-finder":
      return "Business Finder";
    case "qr-leads":
      return "QR Leads";
    case "tracking-id-engine":
      return "Tracking ID Engine";
    default:
      return "Leads Hub";
  }
}

function defaultNextStep(sourceId: SourceId, temperature: LeadTemperature) {
  if (sourceId === "qr-leads") {
    return temperature === "hot"
      ? "Follow up with this QR lead while the intent is fresh."
      : "Review the QR context and decide the best follow-up.";
  }

  if (sourceId === "business-finder") {
    return temperature === "hot"
      ? "Review business fit and prepare first outreach."
      : "Check the business context before outreach.";
  }

  if (sourceId === "social-lead-engine") {
    return temperature === "hot"
      ? "Review the original post/profile and send a relevant manual reply."
      : "Review the context before deciding if this should be contacted.";
  }

  return "Review this opportunity before contacting.";
}

function assertCanRouteToContactManager(temperature: LeadTemperature) {
  if (temperature === "cold") {
    throw new Error("COLD_LEADS_CANNOT_BE_ROUTED");
  }
}

async function buildSocialContactPayload(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  recordId: string;
}): Promise<ContactManagerPayload> {
  const { supabase, userId, recordId } = params;

  const { data, error } = await supabase
    .from("lead_signals")
    .select(
      [
        "id",
        "user_id",
        "source",
        "source_url",
        "snippet",
        "author_hint",
        "temperature",
        "score",
        "why",
        "created_at",
        "source_platform",
        "source_type",
        "external_id",
        "source_username",
        "source_author_url",
        "source_title",
        "source_channel",
        "source_text",
        "why_matched",
        "suggested_opener",
        "tags",
        "status",
        "raw",
        "updated_at",
        "autoaffi_user_code",
        "autoaffi_identity_status",
        "tracking_context",
        "global_pool_id",
      ].join(",")
    )
    .eq("id", recordId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`SOCIAL_LEAD_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("SOCIAL_LEAD_NOT_FOUND");

  const row: any = data;

  const temperature = normalizeTemperature(row.temperature);
  assertCanRouteToContactManager(temperature);

  const title = safeTitle(
    row.source_title,
    row.source_username,
    row.author_hint,
    row.source_platform,
    "Social lead"
  );

  const description = safeDescription(
    row.snippet,
    row.source_text,
    row.source_channel,
    row.source_platform
  );

  return {
    user_id: userId,
    source_type: "social-lead-engine",
    source_record_id: String(row.id),
    source_label: "Social Lead Engine",
    source_url: row.source_url || row.source_author_url || null,

    name: row.source_username || row.author_hint || null,
    title,
    description,
    email: null,
    phone: null,

    temperature,
    status: "new",

    next_step: defaultNextStep("social-lead-engine", temperature),
    suggested_opener: row.suggested_opener || null,
    notes: null,

    last_touch_at: null,
    next_follow_up_at: null,

    is_archived: false,
    is_won: false,
    is_lost: false,
    do_not_contact: false,
    do_not_contact_reason: null,

    meta: {
      source: row.source,
      source_platform: row.source_platform,
      source_type: row.source_type,
      external_id: row.external_id,
      source_username: row.source_username,
      source_author_url: row.source_author_url,
      source_channel: row.source_channel,
      score: row.score,
      why: row.why,
      why_matched: row.why_matched,
      tags: row.tags,
      status: row.status,
      autoaffi_user_code: row.autoaffi_user_code,
      autoaffi_identity_status: row.autoaffi_identity_status,
      tracking_context: row.tracking_context,
      global_pool_id: row.global_pool_id,
      raw: row.raw,
      routed_from: "leads-hub",
    },
  };
}

async function buildBusinessContactPayload(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  recordId: string;
}): Promise<ContactManagerPayload> {
  const { supabase, userId, recordId } = params;

  const { data: pipelineData, error: pipelineError } = await supabase
    .from("business_pipeline")
    .select(
      "id,user_id,target_id,status,score,why,contact_strategy,created_at,updated_at"
    )
    .eq("id", recordId)
    .eq("user_id", userId)
    .maybeSingle();

  if (pipelineError) {
    throw new Error(`BUSINESS_PIPELINE_LOOKUP_FAILED: ${pipelineError.message}`);
  }

  if (!pipelineData) throw new Error("BUSINESS_PIPELINE_NOT_FOUND");

  const pipelineRow: any = pipelineData;

  const { data: targetData, error: targetError } = await supabase
    .from("business_targets")
    .select(
      "id,source,source_id,name,country,city,category,website,phone,rating,domain,size_hint,created_at,updated_at"
    )
    .eq("id", pipelineRow.target_id)
    .maybeSingle();

  if (targetError) {
    throw new Error(`BUSINESS_TARGET_LOOKUP_FAILED: ${targetError.message}`);
  }

  const targetRow: any = targetData || {};

  const temperature = businessTemperature(pipelineRow.score);
  assertCanRouteToContactManager(temperature);

  const title = safeTitle(targetRow?.name, "Business lead");

  const description = safeDescription(
    targetRow?.category,
    targetRow?.city,
    targetRow?.country,
    targetRow?.website || targetRow?.domain,
    targetRow?.phone
  );

  return {
    user_id: userId,
    source_type: "business-finder",
    source_record_id: String(pipelineRow.id),
    source_label: "Business Finder",
    source_url: targetRow?.website || null,

    name: targetRow?.name || null,
    title,
    description,
    email: null,
    phone: targetRow?.phone || null,

    temperature,
    status: "new",

    next_step: defaultNextStep("business-finder", temperature),
    suggested_opener: null,
    notes: null,

    last_touch_at: null,
    next_follow_up_at: null,

    is_archived: false,
    is_won: false,
    is_lost: false,
    do_not_contact: false,
    do_not_contact_reason: null,

    meta: {
      pipeline: pipelineRow,
      target: targetRow,
      score: pipelineRow.score,
      why: pipelineRow.why,
      contact_strategy: pipelineRow.contact_strategy,
      routed_from: "leads-hub",
    },
  };
}

async function buildQrContactPayload(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  recordId: string;
}): Promise<ContactManagerPayload> {
  const { supabase, userId, recordId } = params;

  const { data, error } = await supabase
    .from("qr_leads")
    .select(
      "id,asset_id,user_id,ts,name,email,phone,message,source_type,source_token,source_context,entry_flow,mode,next_url"
    )
    .eq("id", recordId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`QR_LEAD_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("QR_LEAD_NOT_FOUND");

  const row: any = data;

  const temperature = qrTemperature(row);
  assertCanRouteToContactManager(temperature);

  const title = safeTitle(row.name, row.email, row.phone, "QR lead");

  const description = safeDescription(
    row.message,
    row.source_context,
    row.entry_flow,
    row.source_type,
    row.mode
  );

  return {
    user_id: userId,
    source_type: "qr-leads",
    source_record_id: String(row.id),
    source_label: "QR Leads",
    source_url: row.next_url || null,

    name: row.name || null,
    title,
    description,
    email: row.email || null,
    phone: row.phone || null,

    temperature,
    status: "new",

    next_step: defaultNextStep("qr-leads", temperature),
    suggested_opener: null,
    notes: null,

    last_touch_at: null,
    next_follow_up_at: null,

    is_archived: false,
    is_won: false,
    is_lost: false,
    do_not_contact: false,
    do_not_contact_reason: null,

    meta: {
      asset_id: row.asset_id,
      source_type: row.source_type,
      source_token: row.source_token,
      source_context: row.source_context,
      entry_flow: row.entry_flow,
      mode: row.mode,
      original_message: row.message,
      routed_from: "leads-hub",
    },
  };
}

async function buildTrackingContactPayload(): Promise<ContactManagerPayload> {
  throw new Error("TRACKING_SIGNALS_CANNOT_BE_ROUTED_IN_V1");
}

async function buildContactPayload(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  sourceId: SourceId;
  recordId: string;
}) {
  const { supabase, userId, sourceId, recordId } = params;

  if (sourceId === "social-lead-engine") {
    return buildSocialContactPayload({ supabase, userId, recordId });
  }

  if (sourceId === "business-finder") {
    return buildBusinessContactPayload({ supabase, userId, recordId });
  }

  if (sourceId === "qr-leads") {
    return buildQrContactPayload({ supabase, userId, recordId });
  }

  if (sourceId === "tracking-id-engine") {
    return buildTrackingContactPayload();
  }

  throw new Error("UNSUPPORTED_SOURCE");
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin() as SupabaseAdminClient;

    const body = await req.json().catch(() => null);

    const sourceId = normalizeSourceId(body?.sourceId);
    const leadId = asString(body?.leadId);

    if (!sourceId) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_SOURCE_ID",
      });
    }

    if (!leadId) {
      return jsonError(400, {
        ok: false,
        error: "MISSING_LEAD_ID",
      });
    }

    const recordId = stripLeadPrefix(leadId, sourceId);

    if (!recordId) {
      return jsonError(400, {
        ok: false,
        error: "INVALID_LEAD_ID",
      });
    }

    const payload = await buildContactPayload({
      supabase,
      userId,
      sourceId,
      recordId,
    });

    const { data: contactItem, error: upsertError } = await supabase
      .from("contact_manager_items")
      .upsert(payload, {
        onConflict: "user_id,source_type,source_record_id",
      })
      .select("*")
      .single();

    if (upsertError) {
      return jsonError(500, {
        ok: false,
        error: "CONTACT_MANAGER_UPSERT_FAILED",
        details: upsertError.message,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Lead sent to Contact Manager.",
      sourceId,
      sourceLabel: sourceLabel(sourceId),
      sourceRecordId: recordId,
      contactItem,
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";

    const status =
      msg === "UNAUTHORIZED"
        ? 401
        : msg === "COLD_LEADS_CANNOT_BE_ROUTED"
          ? 400
          : msg === "TRACKING_SIGNALS_CANNOT_BE_ROUTED_IN_V1"
            ? 400
            : msg.includes("NOT_FOUND")
              ? 404
              : 500;

    return jsonError(status, {
      ok: false,
      error: msg,
    });
  }
}