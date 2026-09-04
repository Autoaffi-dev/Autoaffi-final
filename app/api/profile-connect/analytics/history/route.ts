import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireUserId } from "@/lib/auth/server";
import type { PlatformKey, StepKey } from "@/lib/profile-connect/engine/types";

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
    const url = new URL(req.url);

    const platform = url.searchParams.get("platform") as PlatformKey | null;
    const step = url.searchParams.get("step") as StepKey | null;
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);

    let query = supabase
      .from("profile_connect_content_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (platform) query = query.eq("platform", platform);
    if (step) query = query.eq("step", step);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      history: data || [],
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to fetch profile connect history",
      },
      { status: 401 }
    );
  }
}
