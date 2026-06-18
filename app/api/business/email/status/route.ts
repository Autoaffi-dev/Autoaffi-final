import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectedInboxRow = {
  user_id: string;
  provider: string | null;
  email: string | null;
  status: string | null;
  is_active: boolean | null;
  connected_at: string | null;
};

function normalizeProvider(
  provider: string | null | undefined
): "gmail" | "outlook" | "other" | undefined {
  const value = String(provider ?? "").trim().toLowerCase();

  if (!value) return undefined;
  if (value.includes("gmail") || value.includes("google")) return "gmail";
  if (
    value.includes("outlook") ||
    value.includes("microsoft") ||
    value.includes("office365") ||
    value.includes("office_365")
  ) {
    return "outlook";
  }

  return "other";
}

function isConnectedInbox(row: ConnectedInboxRow | null | undefined) {
  if (!row) return false;

  const status = String(row.status ?? "").trim().toLowerCase();
  const isActive = row.is_active === true;

  return isActive || status === "connected" || status === "active";
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("user_connected_inboxes")
      .select("user_id, provider, email, status, is_active, connected_at")
      .eq("user_id", userId)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "DB_READ_FAILED",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const row = (data ?? null) as ConnectedInboxRow | null;
    const connected = isConnectedInbox(row);

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        connected,
        provider: connected ? normalizeProvider(row?.provider) : undefined,
        email: connected ? row?.email ?? null : null,
        connectedAt: connected ? row?.connected_at ?? null : null,
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