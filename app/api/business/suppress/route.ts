import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type SuppressionType = "hard" | "cooldown";

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";

  if (!url) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function getUserIdFromRequest(req: Request) {
  return req.headers.get("x-autoaffi-user-id")?.trim() || null;
}

function isValidSuppressionType(type: any): type is SuppressionType {
  return type === "hard" || type === "cooldown";
}

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing required header: x-autoaffi-user-id" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const targetId = body?.targetId;
    const type = body?.type;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
    const suppressedUntil =
      typeof body?.suppressedUntil === "string" && body.suppressedUntil.trim()
        ? body.suppressedUntil.trim()
        : null;

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing required field: targetId" },
        { status: 400 }
      );
    }

    if (!isValidSuppressionType(type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing required field: type" },
        { status: 400 }
      );
    }

    if (type === "cooldown" && !suppressedUntil) {
      return NextResponse.json(
        {
          ok: false,
          error: "suppressedUntil is required when type = cooldown",
        },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    // 1) Verify target exists
    const { data: targetRow, error: targetError } = await supabase
      .from("business_targets")
      .select("id, name, source, source_id")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check target",
          details: targetError.message,
        },
        { status: 500 }
      );
    }

    if (!targetRow) {
      return NextResponse.json(
        { ok: false, error: "Target not found" },
        { status: 404 }
      );
    }

    // 2) Remove existing suppression rows for same target
    //    so we keep only the latest suppression state
    const { error: deleteOldSuppressionError } = await supabase
      .from("business_suppressions")
      .delete()
      .eq("target_id", targetId);

    if (deleteOldSuppressionError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to clear previous suppression state",
          details: deleteOldSuppressionError.message,
        },
        { status: 500 }
      );
    }

    // 3) Insert new suppression row
    const suppressionPayload = {
      target_id: targetId,
      type,
      reason: reason ?? null,
      suppressed_at: nowIso,
      suppressed_until: type === "cooldown" ? suppressedUntil : null,
    };

    const { error: insertSuppressionError } = await supabase
      .from("business_suppressions")
      .insert(suppressionPayload);

    if (insertSuppressionError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to create suppression row",
          details: insertSuppressionError.message,
        },
        { status: 500 }
      );
    }

    // 4) Remove claim(s) for target
    const { error: deleteClaimError } = await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", targetId);

    if (deleteClaimError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to remove claim",
          details: deleteClaimError.message,
        },
        { status: 500 }
      );
    }

    // 5) Update pipeline rows for this target
    const nextPipelineStatus =
      type === "hard" ? "SUPPRESSED" : "COOLDOWN";

    const { error: updatePipelineError } = await supabase
      .from("business_pipeline")
      .update({
        status: nextPipelineStatus,
        updated_at: nowIso,
      })
      .eq("target_id", targetId);

    if (updatePipelineError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to update pipeline rows",
          details: updatePipelineError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      suppression: {
        targetId,
        type,
        reason: reason ?? null,
        suppressedAt: nowIso,
        suppressedUntil: type === "cooldown" ? suppressedUntil : null,
      },
      claimRemoved: true,
      pipelineStatus: nextPipelineStatus,
      target: {
        id: targetRow.id,
        name: targetRow.name,
        source: targetRow.source,
        sourceId: targetRow.source_id,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request",
        details: err?.message ?? null,
      },
      { status: 400 }
    );
  }
}