import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ✅ uuid-validering (Supabase user_id är uuid)
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ✅ Förhindrar: "invalid input syntax for type uuid"
  if (!isUuid(userId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_user_id_not_uuid",
        received: userId,
        hint:
          "Din session.user.id är inte Supabase UUID. Fix krävs i NextAuth callbacks så session.user.id blir Supabase auth user id (uuid).",
      },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("platform,status,token_expires_at,updated_at")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    platforms: data ?? [],
  });
}