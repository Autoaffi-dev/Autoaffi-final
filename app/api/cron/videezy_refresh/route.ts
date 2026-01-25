import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ===========================
// 🔧 KONFIG – ÄNDRA HÄR
// ===========================

// Vilka ämnen cron-jobbet ska fylla biblioteket med
const KEYWORDS = ["ai", "money", "motivation", "business"];

// Hur många klipp per keyword och körning
// (ändra t.ex. till 10 eller 20 om du vill växa snabbare)
const PER_KEYWORD = 5;

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // BEHÖVER SERVICE ROLE FÖR CRON
    );

    // ===========================
    // 1) Läs in alla befintliga URL:er
    // ===========================
    const { data: existingRows, error: existingError } = await supabase
      .from("videezy_assets")
      .select("url");

    if (existingError) throw existingError;

    const existingUrls = new Set<string>(
      (existingRows || [])
        .map((r: any) => r.url as string)
        .filter(Boolean)
    );

    // ===========================
    // 2) Bygg kandidater (demo-datan)
    // ===========================
    const candidates: any[] = [];

    for (const word of KEYWORDS) {
      for (let i = 0; i < PER_KEYWORD; i++) {
        // TODO – Skarpa delen: Scrape Videezy och fyll med riktiga värden
        candidates.push({
          keyword: word,
          title: `Sample video for ${word} #${i + 1}`,
          // I skarp version ska detta vara den riktiga mp4-URL:en från Videezy
          url: `https://cdn.videezy.com/dummy-sample-${word}-${i}.mp4`,
          cover_url: "https://cdn.videezy.com/sample-thumb.jpg",
          duration: 7,
          width: 1920,
          height: 1080,
          source_page: "https://videezy.com/dummy",
          score: Math.random() * 10,
        });
      }
    }

    // ===========================
    // 3) Filtrera bort dubbletter (per URL)
    // ===========================
    const newAssets = candidates.filter(
      (asset) => asset.url && !existingUrls.has(asset.url)
    );

    if (newAssets.length === 0) {
      // Inget nytt att lägga till – helt OK
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped: candidates.length,
        reason: "No new URLs (all already in library)",
      });
    }

    // ===========================
    // 4) Lägg in ENBART nya rader
    // ===========================
    const { error } = await supabase.from("videezy_assets").insert(newAssets);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      inserted: newAssets.length,
      skipped: candidates.length - newAssets.length,
    });
  } catch (err: any) {
    console.error("CRON ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}