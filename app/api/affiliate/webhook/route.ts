import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("Affiliate webhook received:", data);

    const { affiliate, user_id, product, commission, status, timestamp, platform } = data;

    const { error } = await supabase.from("affiliate_sales").insert([
      {
        affiliate,
        user_id,
        product,
        commission,
        status,
        timestamp,
        platform: platform || affiliate // om platform saknas → fyll med affiliate-namn
      }
    ]);

    if (error) {
      console.error("❌ Error saving to Supabase:", error.message);
      return NextResponse.json({ ok: false, error: error.message });
    }

    console.log("✅ Sale saved to Supabase");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Webhook error:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}