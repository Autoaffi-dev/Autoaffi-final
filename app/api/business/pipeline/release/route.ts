import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
    const targetId =
      typeof body?.targetId === "string" ? body.targetId.trim() : "";

    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: targetId" },
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

    // 2) Check if this user has a claim on target
    const { data: existingClaim, error: existingClaimError } = await supabase
      .from("business_claims")
      .select("target_id, claimed_by")
      .eq("target_id", targetId)
      .eq("claimed_by", userId)
      .maybeSingle();

    if (existingClaimError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check existing claim",
          details: existingClaimError.message,
        },
        { status: 500 }
      );
    }

    if (!existingClaim) {
      return NextResponse.json(
        {
          ok: false,
          error: "No active claim found for this user and target",
        },
        { status: 404 }
      );
    }

    // 3) Delete claim
    const { error: deleteClaimError } = await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", targetId)
      .eq("claimed_by", userId);

    if (deleteClaimError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to release claim",
          details: deleteClaimError.message,
        },
        { status: 500 }
      );
    }

    // 4) Update pipeline row for this user + target
    const { error: updatePipelineError } = await supabase
      .from("business_pipeline")
      .update({
        status: "RELEASED",
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .eq("target_id", targetId);

    if (updatePipelineError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to update pipeline row",
          details: updatePipelineError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      released: true,
      target: {
        id: targetRow.id,
        name: targetRow.name,
        source: targetRow.source,
        sourceId: targetRow.source_id,
      },
      pipelineStatus: "RELEASED",
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