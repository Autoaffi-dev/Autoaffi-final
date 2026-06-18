import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserId } from "@/lib/supabase/server";

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

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);

    const body = await req.json();
    const targetId =
      typeof body?.targetId === "string" ? body.targetId.trim() : "";
    const campaignId =
      typeof body?.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : null;

    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: targetId" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

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

    const { data: existingWin, error: existingWinError } = await supabase
      .from("business_wins")
      .select("target_id, user_id, campaign_id, won_at")
      .eq("target_id", targetId)
      .eq("user_id", userId)
      .order("won_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingWinError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check existing win row",
          details: existingWinError.message,
        },
        { status: 500 }
      );
    }

    let winMode: "created" | "existing" = "created";

    if (!existingWin) {
      const { error: insertWinError } = await supabase
        .from("business_wins")
        .insert({
          target_id: targetId,
          user_id: userId,
          campaign_id: campaignId,
          won_at: nowIso,
        });

      if (insertWinError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create win row",
            details: insertWinError.message,
          },
          { status: 500 }
        );
      }
    } else {
      winMode = "existing";
    }

    const { error: updatePipelineError } = await supabase
      .from("business_pipeline")
      .update({
        status: "WON",
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

    const { error: deleteClaimError } = await supabase
      .from("business_claims")
      .delete()
      .eq("target_id", targetId)
      .eq("claimed_by", userId);

    if (deleteClaimError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to delete claim after win",
          details: deleteClaimError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      win: {
        targetId,
        userId,
        campaignId,
        wonAt: existingWin?.won_at ?? nowIso,
        mode: winMode,
      },
      pipelineStatus: "WON",
      target: {
        id: targetRow.id,
        name: targetRow.name,
        source: targetRow.source,
        sourceId: targetRow.source_id,
      },
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status }
    );
  }
}