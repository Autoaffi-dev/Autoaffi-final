import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------
// SAVE AFFILIATE IDs FOR USER
// ---------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      digistoreId,
      myleadId,
      cpaleadId,
      amazonTag,
      impactId,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_affiliate_ids")
      .upsert(
        {
          user_id: userId,
          digistore_id: digistoreId ?? null,
          mylead_id: myleadId ?? null,
          cpalead_id: cpaleadId ?? null,
          amazon_tag: amazonTag ?? null,
          impact_id: impactId ?? null,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[save-ids] insert error:", error);
      return NextResponse.json(
        { error: "Failed to save affiliate IDs" },
        { status: 500 }
      );
    }

    // Tell Mega Engine 1 that affiliate data has changed
    // (this triggers re-sync for Product Discovery / Reels / Posts)
    // — Hook will be added later in MegaEngine1 v1.2
    // await MegaEngine1.invalidateUserCache(userId);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[save-ids] exception:", err);
    return NextResponse.json({ error: "Exception" }, { status: 500 });
  }
}