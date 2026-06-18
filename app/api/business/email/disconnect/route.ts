import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("user_connected_inboxes")
      .update({
        is_active: false,
        status: "disconnected",
        disconnected_at: nowIso,
      })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "DISCONNECT_FAILED",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        connected: false,
        disconnectedAt: nowIso,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: msg,
      },
      { status }
    );
  }
}