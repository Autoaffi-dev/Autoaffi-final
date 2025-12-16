import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    // 🔥 Exempel: logga AI Coach start
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
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}