// app/api/social/disconnect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const platform = (body?.platform || "").toLowerCase();

  if (!platform) {
    return NextResponse.json({ error: "missing_platform" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .update({
      status: "disconnected",
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", platform);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}