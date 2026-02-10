import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("platform,status,token_expires_at,updated_at")
    .eq("user_id", String(userId));

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const platforms = data ?? [];

  // ✅ Enkel “connected”-map för UI
  const connected = platforms.reduce((acc: Record<string, boolean>, row: any) => {
    acc[String(row.platform)] = String(row.status) === "connected";
    return acc;
  }, {});

  return NextResponse.json(
    {
      ok: true,
      platforms,
      connected,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}