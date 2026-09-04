import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserId } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    void body?.userId;

    await supabase.from("ai_coach_events").insert({
      user_id: userId,
      event_type: "coach_started",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "AI Coach started",
    });
  } catch (err: any) {
    const msg = err?.message;
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
