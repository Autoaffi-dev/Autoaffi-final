import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/products/event
 * body: { productId, eventType: "view"|"click"|"attach", userId?: string, meta?: object }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const productId = body?.productId;
    const eventType = body?.eventType;
    const userId = body?.userId ?? null;
    const meta = body?.meta ?? {};

    if (!productId || !eventType) {
      return NextResponse.json({ error: "Missing productId or eventType" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.from("product_events").insert({
      user_id: userId,
      product_id: productId,
      event_type: eventType,
      source: meta?.source ?? "unknown",
      meta,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Event log failed" },
      { status: 500 }
    );
  }
}