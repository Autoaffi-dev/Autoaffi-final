import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireUserId } from "@/lib/auth/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserId(req: Request): Promise<string> {
  return requireUserId(req);
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    const body = await req.json();

    const niche = body.niche?.trim() || null;
    const audience = body.audience?.trim() || null;
    const outcome = body.outcome?.trim() || null;
    const locale = body.locale?.trim() || "en";
    const tone = body.tone?.trim() || "friendly";

    if (!["friendly", "direct", "premium"].includes(tone)) {
      return NextResponse.json(
        { ok: false, error: "Invalid tone" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_brand_profile")
      .upsert(
        {
          user_id: userId,
          niche,
          audience,
          outcome,
          locale,
          tone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      brand_profile: data,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to save brand profile",
      },
      { status: 401 }
    );
  }
}