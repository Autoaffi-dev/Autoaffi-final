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

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);

    const { data, error } = await supabase
      .from("user_brand_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      brand_profile: data || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to fetch brand profile",
      },
      { status: 401 }
    );
  }
}