import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadTemperature = "cold" | "warm" | "hot";

type NormalizedLead = {
  id: string;
  sourceId:
    | "social-lead-engine"
    | "business-finder"
    | "qr-leads"
    | "tracking-id-engine";

  title: string;
  description: string;
  temperature: LeadTemperature;
  status: string;
  createdAt: string | null;

  sourceLabel: string;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;

  score?: number | null;
  suggestedOpener?: string | null;

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

  return "Untitled lead";
}

function safeDescription(...values: unknown[]) {
  const parts = values
    .map((value) => asString(value))
    .filter(Boolean)
    .slice(0, 4);

  return parts.length ? parts.join(" · ") : "No extra context yet.";
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    const [
      socialResult,
      businessPipelineResult,
      qrResult,
      trackingResult,
      settingsResult,
    ] = await Promise.all([
      supabase
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
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),

      supabase
        .from("business_pipeline")
        .select(
          "id,user_id,target_id,status,score,why,contact_strategy,created_at,updated_at"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit),

      supabase
        .from("qr_leads")
        .select(
          "id,asset_id,user_id,ts,name,email,phone,message,source_type,source_token,source_context,entry_flow,mode,next_url"
        )
        .eq("user_id", userId)
        .order("ts", { ascending: false })
        .limit(limit),

      supabase
        .from("offer_click_events")
        .select(
          "id,user_id,offer_id,source,external_id,title,subid,affiliate_link,context,referer,user_agent,ip_address,clicked_at,created_at"
        )
        .eq("user_id", userId)
        .order("clicked_at", { ascending: false })
        .limit(limit),

      supabase
        .from("user_lead_source_settings")
        .select(
          "source_key,is_activated,activated_at,deactivated_at,external_account_status,manual_contacts_logged,manual_deals_logged,metadata,updated_at"
        )
        .eq("user_id", userId),
    ]);

    if (socialResult.error) {
      return jsonError(500, {
        ok: false,
        error: "SOCIAL_LEADS_FAILED",
        details: socialResult.error.message,
      });
    }

    if (businessPipelineResult.error) {
      return jsonError(500, {
        ok: false,
        error: "BUSINESS_PIPELINE_FAILED",
        details: businessPipelineResult.error.message,
      });
    }

    if (qrResult.error) {
      return jsonError(500, {
        ok: false,
        error: "QR_LEADS_FAILED",
        details: qrResult.error.message,
      });
    }

    if (trackingResult.error) {
      return jsonError(500, {
        ok: false,
        error: "TRACKING_EVENTS_FAILED",
        details: trackingResult.error.message,
      });
    }

    if (settingsResult.error) {
      return jsonError(500, {
        ok: false,
        error: "SOURCE_SETTINGS_FAILED",
        details: settingsResult.error.message,
      });
    }

    const businessRows = businessPipelineResult.data || [];

    const targetIds = businessRows
      .map((row: any) => asString(row.target_id))
      .filter(Boolean);

    let businessTargetsById: Record<string, any> = {};

    if (targetIds.length) {
      const { data: targetRows, error: targetErr } = await supabase
        .from("business_targets")
        .select(
          "id,source,source_id,name,country,city,category,website,phone,rating,domain,size_hint,created_at,updated_at"
        )
        .in("id", targetIds);

      if (targetErr) {
        return jsonError(500, {
          ok: false,
          error: "BUSINESS_TARGETS_FAILED",
          details: targetErr.message,
        });
      }

      businessTargetsById = Object.fromEntries(
        (targetRows || []).map((target: any) => [String(target.id), target])
      );
    }

    const socialLeads: NormalizedLead[] = (socialResult.data || []).map(
      (row: any) => {
        const title = safeTitle(
          row.source_title,
          row.source_username,
          row.author_hint,
          row.source_platform,
          "Social lead"
        );

        return {
          id: `social:${row.id}`,
          sourceId: "social-lead-engine",
          title,
          description: safeDescription(
            row.snippet,
            row.source_text,
            row.source_channel,
            row.source_platform
          ),
          temperature: normalizeTemperature(row.temperature),
          status: asString(row.status, "new"),
          createdAt: row.created_at ?? null,
          sourceLabel: "Social Lead Engine",
          sourcePlatform: row.source_platform ?? null,
          sourceUrl: row.source_url || row.source_author_url || null,
          score:
            typeof row.score === "number" ? row.score : Number(row.score || 0),
          suggestedOpener: row.suggested_opener ?? null,
          meta: {
            source: row.source,
            source_type: row.source_type,
            external_id: row.external_id,
            source_username: row.source_username,
            source_author_url: row.source_author_url,
            source_channel: row.source_channel,
            why: row.why,
            why_matched: row.why_matched,
            tags: row.tags,
            autoaffi_identity_status: row.autoaffi_identity_status,
            tracking_context: row.tracking_context,
            global_pool_id: row.global_pool_id,
            raw: row.raw,
          },
        };
      }
    );

    const businessLeads: NormalizedLead[] = businessRows.map((row: any) => {
      const target = businessTargetsById[String(row.target_id)] || {};

      return {
        id: `business:${row.id}`,
        sourceId: "business-finder",
        title: safeTitle(target.name, "Business lead"),
        description: safeDescription(
          target.category,
          target.city,
          target.country,
          target.website || target.domain,
          target.phone
        ),
        temperature: businessTemperature(row.score),
        status: asString(row.status, "new"),
        createdAt: row.updated_at || row.created_at || null,
        sourceLabel: "Business Finder",
        sourcePlatform: "business",
        sourceUrl: target.website || null,
        score:
          typeof row.score === "number" ? row.score : Number(row.score || 0),
        suggestedOpener: null,
        meta: {
          target_id: row.target_id,
          pipeline_id: row.id,
          why: row.why,
          contact_strategy: row.contact_strategy,
          target,
        },
      };
    });

    const qrLeads: NormalizedLead[] = (qrResult.data || []).map((row: any) => {
      return {
        id: `qr:${row.id}`,
        sourceId: "qr-leads",
        title: safeTitle(row.name, row.email, row.phone, "QR lead"),
        description: safeDescription(
          row.message,
          row.source_context,
          row.entry_flow,
          row.source_type,
          row.mode
        ),
        temperature: qrTemperature(row),
        status: "new",
        createdAt: row.ts ?? null,
        sourceLabel: "QR Leads",
        sourcePlatform: "qr",
        sourceUrl: row.next_url ?? null,
        score: null,
        suggestedOpener: null,
        meta: {
          asset_id: row.asset_id,
          email: row.email,
          phone: row.phone,
          source_type: row.source_type,
          source_token: row.source_token,
          source_context: row.source_context,
          entry_flow: row.entry_flow,
          mode: row.mode,
          next_url: row.next_url,
        },
      };
    });

    const trackingLeads: NormalizedLead[] = (trackingResult.data || []).map(
      (row: any) => {
        return {
          id: `tracking:${row.id}`,
          sourceId: "tracking-id-engine",
          title: safeTitle(row.title, row.source, "Tracking signal"),
          description: safeDescription(row.context, row.referer, row.source),
          temperature: "cold",
          status: "clicked",
          createdAt: row.clicked_at || row.created_at || null,
          sourceLabel: "Tracking ID Engine",
          sourcePlatform: "tracking",
          sourceUrl: row.referer ?? null,
          score: null,
          suggestedOpener: null,
          meta: {
            offer_id: row.offer_id,
            source: row.source,
            external_id: row.external_id,
            subid: row.subid,
            affiliate_link: row.affiliate_link,
            context: row.context,
            referer: row.referer,
            user_agent: row.user_agent,
            clicked_at: row.clicked_at,
            note:
              "Tracking clicks are signals only unless tied to a known opt-in lead.",
          },
        };
      }
    );

    const leads = [
      ...socialLeads,
      ...businessLeads,
      ...qrLeads,
      ...trackingLeads,
    ].sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bd - ad;
    });

    const sourceSettingsRows = settingsResult.data || [];

    const mlgsRow =
      sourceSettingsRows.find((row: any) => row.source_key === "mlgs") ?? null;

    const communityBoostRow =
      sourceSettingsRows.find(
        (row: any) => row.source_key === "community-boost"
      ) ?? null;

    const sourceSettings = {
      mlgs: {
        isActivated: mlgsRow?.is_activated ?? false,
        row: mlgsRow,
      },
      communityBoost: {
        isActivated: communityBoostRow?.is_activated ?? false,
        row: communityBoostRow,
      },
    };

    return NextResponse.json({
      ok: true,
      mode: "live",
      userId,
      count: leads.length,
      counts: {
        all: leads.length,
        hot: leads.filter((lead) => lead.temperature === "hot").length,
        warm: leads.filter((lead) => lead.temperature === "warm").length,
        cold: leads.filter((lead) => lead.temperature === "cold").length,
      },
      bySource: {
        socialLeadEngine: socialLeads.length,
        businessFinder: businessLeads.length,
        qrLeads: qrLeads.length,
        trackingIdEngine: trackingLeads.length,
      },
      sourceSettings,
      leads,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;

    return jsonError(status, {
      ok: false,
      error: msg,
    });
  }
}
