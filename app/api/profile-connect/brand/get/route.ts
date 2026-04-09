import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions"; // justera path om din authOptions ligger annanstans

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserId(req: Request): Promise<string> {
  const devHeader = req.headers.get("x-autoaffi-user-id");
  if (devHeader) return devHeader;

  const devEnv = process.env.NEXT_PUBLIC_DEV_USER_ID;
  if (devEnv) return devEnv;

  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id;

  if (!userId) throw new Error("Unauthorized");
  return userId;
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