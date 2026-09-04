import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();
    const today = getTodayDate();

    const { data, error } = await supabase
      .from("contact_manager_daily_briefs")
      .select(
        `
        id,
        user_id,
        brief_date,
        title,
        summary,
        priority_focus,
        manual_lead_task,
        warning,
        success_task,
        hot_lead_ids,
        warm_lead_ids,
        follow_up_lead_ids,
        no_answer_lead_ids,
        successful_lead_ids,
        plan_items,
        message_suggestions,
        meta,
        created_at,
        updated_at
      `
      )
      .eq("user_id", userId)
      .eq("brief_date", today)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_MANAGER_DAILY_BRIEF_READ_FAILED",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        userId,
        briefDate: today,
        brief: data || null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message || "CONTACT_MANAGER_DAILY_BRIEF_FAILED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        brief: null,
      },
      { status }
    );
  }
}