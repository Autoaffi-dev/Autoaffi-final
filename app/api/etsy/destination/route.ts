import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("user_offer_destinations")
      .select("destination_url, updated_at")
      .eq("user_id", userId)
      .single();

    if (error) return NextResponse.json({ destination_url: null }, { status: 200 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const admin = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const destination_url = String(body?.destination_url || "").trim();
    if (!destination_url.startsWith("http")) {
      return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
    }

    const { error } = await admin.from("user_offer_destinations").upsert({
      user_id: userId,
      offer_key: "autoaffi_recurring",
      destination_url,
      updated_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}