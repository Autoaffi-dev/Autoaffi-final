import { NextResponse } from "next/server";
import { disconnectedInboxIds } from "@/lib/business/email/gmailLifecycle";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: activeRows, error: selectError } = await supabase
      .from("user_connected_inboxes")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (selectError) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "DISCONNECT_FAILED",
          details: selectError.message,
        },
        { status: 500 }
      );
    }

    const inboxIds = disconnectedInboxIds(activeRows);

    if (inboxIds.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          mode: "live",
          connected: false,
          disconnectedAt: nowIso,
        },
        { status: 200 }
      );
    }

    const { error: tokenDeactivateError } = await supabase
      .from("user_connected_inbox_tokens")
      .update({
        is_active: false,
      })
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("inbox_id", inboxIds);

    if (tokenDeactivateError) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "TOKEN_DEACTIVATE_FAILED",
          details: tokenDeactivateError.message,
        },
        { status: 500 }
      );
    }

    const { error: disconnectError } = await supabase
      .from("user_connected_inboxes")
      .update({
        is_active: false,
        status: "disconnected",
        disconnected_at: nowIso,
        send_enabled: false,
        sync_replies_enabled: false,
      })
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("id", inboxIds);

    if (disconnectError) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "DISCONNECT_FAILED",
          details: disconnectError.message,
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
