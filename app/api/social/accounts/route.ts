import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userIdRaw = (session as any)?.user?.id;

  if (!userIdRaw) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = String(userIdRaw);
  if (!isUuid(userId)) {
    return NextResponse.json(
      { ok: false, error: "session_user_id_not_uuid", received: userId },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("id,platform,provider,status,username,account_id,token_expires_at,updated_at,meta")
    .eq("user_id", userId)
    .order("platform", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const platforms = (data ?? []).map((row: any) => {
    const lastSyncAt = row?.meta?.last_sync?.at || row?.updated_at || null;
    return { ...row, last_synced_at: lastSyncAt };
  });

  const connected = platforms.reduce((acc: Record<string, boolean>, row: any) => {
    acc[String(row.platform)] = String(row.status) === "connected";
    return acc;
  }, {});

  return NextResponse.json(
    { ok: true, platforms, connected },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}