import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;

  const cleaned = sanitizeHeaderId(String(value));

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    cleaned
  );
}

async function getEffectiveUserId(req: Request) {
  try {
    return await requireUserId(req);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UNAUTHORIZED");
    }

    const headerUserId = sanitizeHeaderId(
      req.headers.get("x-autoaffi-user-id") || ""
    );

    const devUserId = sanitizeHeaderId(
      (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim() ||
        (process.env.DEV_USER_ID || "").trim() ||
        (process.env.AUTOAFFI_DEV_USER_ID || "").trim()
    );

    if (isUuid(headerUserId)) return headerUserId;
    if (isUuid(devUserId)) return devUserId;

    throw new Error("UNAUTHORIZED");
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const userId = await getEffectiveUserId(req);
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