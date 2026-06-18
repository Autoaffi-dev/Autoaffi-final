import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadStatus = "new" | "saved" | "contacted" | "replied" | "won" | "dismissed";

type RequestBody = {
  leadId?: string;
  externalId?: string;
  status?: LeadStatus;
};

const ALLOWED_STATUSES: LeadStatus[] = [
  "new",
  "saved",
  "contacted",
  "replied",
  "won",
  "dismissed",
];

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details,
    },
    { status }
  );
}

function isAllowedStatus(status: unknown): status is LeadStatus {
  return typeof status === "string" && ALLOWED_STATUSES.includes(status as LeadStatus);
}

async function getUserId(req: NextRequest) {
  const devHeaderUserId = req.headers.get("x-autoaffi-user-id");

  if (
    process.env.NODE_ENV !== "production" &&
    devHeaderUserId &&
    devHeaderUserId.length > 10
  ) {
    return devHeaderUserId;
  }

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  return sessionUserId || null;
}

function claimStatusFromLeadStatus(status: LeadStatus) {
  if (status === "won") return "won";

  // Dismissed should not be re-offered to another customer for now.
  // Safer than "released", because we do not want the same weak/irrelevant lead
  // bouncing around to multiple users.
  if (status === "dismissed") return "suppressed";

  return "claimed";
}

async function findLeadForUser(params: {
  userId: string;
  leadId?: string;
  externalId?: string;
}) {
  const { userId, leadId, externalId } = params;

  let query = supabaseAdmin
    .from("lead_signals")
    .select(
      "id, user_id, external_id, source_platform, source_type, source_url, source_username, source_text, snippet, status, score, temperature, suggested_opener, created_at, updated_at"
    )
    .eq("user_id", userId)
    .limit(1);

  if (leadId) {
    query = query.eq("id", leadId);
  } else if (externalId) {
    query = query.eq("external_id", externalId);
  } else {
    throw new Error("Missing leadId or externalId");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lead: ${error.message}`);
  }

  return data;
}

async function updateLeadStatus(params: {
  userId: string;
  leadId: string;
  externalId: string | null;
  status: LeadStatus;
}) {
  const { userId, leadId, externalId, status } = params;

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("lead_signals")
    .update({
      status,
      updated_at: now,
    })
    .eq("id", leadId)
    .eq("user_id", userId)
    .select(
      "id, user_id, external_id, source_platform, source_type, source_url, source_username, source_text, snippet, status, score, temperature, suggested_opener, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update lead status: ${error.message}`);
  }

  if (!data) {
    throw new Error("Lead not found after update");
  }

  if (externalId) {
    const claimStatus = claimStatusFromLeadStatus(status);

    const { error: claimError } = await supabaseAdmin
      .from("lead_signal_claims")
      .update({
        claim_status: claimStatus,
        updated_at: now,
      })
      .eq("external_id", externalId)
      .eq("claimed_by_user_id", userId);

    if (claimError) {
      throw new Error(`Failed to update lead claim status: ${claimError.message}`);
    }
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);

    if (!userId) {
      return jsonError("Unauthorized. Could not resolve user_id.", 401);
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;

    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    const externalId =
      typeof body.externalId === "string" ? body.externalId.trim() : "";

    if (!leadId && !externalId) {
      return jsonError("Missing leadId or externalId", 400);
    }

    if (!isAllowedStatus(body.status)) {
      return jsonError("Invalid status", 400, {
        allowedStatuses: ALLOWED_STATUSES,
      });
    }

    const lead = await findLeadForUser({
      userId,
      leadId: leadId || undefined,
      externalId: externalId || undefined,
    });

    if (!lead) {
      return jsonError("Lead not found for this user", 404);
    }

    const updatedLead = await updateLeadStatus({
      userId,
      leadId: lead.id,
      externalId: lead.external_id,
      status: body.status,
    });

    return NextResponse.json({
      ok: true,
      route: "/api/dashboard/lead-engine/status",
      status: body.status,
      lead: updatedLead,
      claimStatus: claimStatusFromLeadStatus(body.status),
    });
  } catch (error) {
    console.error("[lead-engine-status-route]", error);

    return jsonError(
      "Lead status update failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/dashboard/lead-engine/status",
    method: "POST",
    allowedStatuses: ALLOWED_STATUSES,
    bodyExample: {
      leadId: "lead_signals_row_id",
      status: "saved",
    },
    alternativeBodyExample: {
      externalId: "youtube_VIDEOID_COMMENTID",
      status: "contacted",
    },
  });
}