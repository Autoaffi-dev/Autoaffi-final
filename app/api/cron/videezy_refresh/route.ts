import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // BEHÖVER SERVICE ROLE FÖR CRON
    );

    // STEG 1 – Hämta 20 videor för några keywords (demoversion)
    const keywords = ["ai", "money", "motivation", "business"];

    const newAssets: any[] = [];

    for (const word of keywords) {
      // TODO – Skarpa delen: Scrape Videezy
      // Nu: lägg bara in demo-poster så systemet funkar
      newAssets.push({
        keyword: word,
        title: `Sample video for ${word}`,
        url: "https://cdn.videezy.com/dummy-sample.mp4",
        cover_url: "https://cdn.videezy.com/sample-thumb.jpg",
        duration: 7,
        width: 1920,
        height: 1080,
        source_page: "https://videezy.com/dummy",
        score: Math.random() * 10,
      });
    }

    // STEG 2 – Töm tabellen
    await supabase.from("videezy_assets").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // STEG 3 – Lägg in nytt
    const { error } = await supabase.from("videezy_assets").insert(newAssets);

    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: newAssets.length });
  } catch (err: any) {
    console.error("CRON ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}