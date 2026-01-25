import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Våra fördefinierade plattformar (hjärtekort + 8 externa)
const BASE_PLATFORMS = [
  {
    id: "autoaffi",
    name: "Autoaffi Recurring",
    commission: 20,
    highlight: true,
    note: "Our own heart-program – 20% recurring on all customer revenue."
  },
  {
    id: "adcreative",
    name: "AdCreative.ai",
    commission: 30,
    highlight: true,
    note: "AI ad creatives with lifetime commissions while customer is active."
  },
  {
    id: "socialbee",
    name: "SocialBee",
    commission: 30,
    highlight: true,
    note: "Social media management with strong recurring."
  },
  {
    id: "thinkific",
    name: "Thinkific",
    commission: 30,
    highlight: false,
    note: "Course platform – recurring as long as student subsists."
  },
  {
    id: "learnworlds",
    name: "LearnWorlds",
    commission: 30,
    highlight: false,
    note: "Advanced online course & school builder – recurring."
  },
  {
    id: "browseai",
    name: "Browse AI",
    commission: 30,
    highlight: false,
    note: "No-code web automation & scraping – strong SaaS economics."
  },
  {
    id: "tubemagic",
    name: "TubeMagic",
    commission: 30,
    highlight: true,
    note: "YouTube/Video AI – recurring creator SaaS."
  },
  {
    id: "systeme",
    name: "Systeme.io",
    commission: 40,
    highlight: true,
    note: "Funnels + email – one of the most legendary recurring programs."
  },
  {
    id: "clickfunnels",
    name: "ClickFunnels",
    commission: 30,
    highlight: false,
    note: "Funnel giant – strong recurring, especially on higher plans."
  },
  {
    id: "writesonic",
    name: "Writesonic",
    commission: 30,
    highlight: false,
    note: "AI writing platform – recurring as long as customer is active."
  }
];

// Bygger affiliatelänkar baserat på subId
function buildAffiliateUrl(platformId: string, subId: string | null): string | null {
  if (!subId) return null;

  // OBS: byt ut dessa när du har riktiga affiliate-bas-URL:er
  switch (platformId) {
    case "autoaffi":
      // Denna kan vi kontrollera själva
      return `https://www.autoaffi.com/go/recurring/${subId}`;
    default:
      // Placeholder tills du har riktiga länkar per plattform
      return `https://example.com/${platformId}?subid=${subId}`;
  }
}

export async function GET(req: Request) {
  try {
    // Här skulle du normalt plocka userId via session / header.
    // Just nu kör vi utan filter och litar på att du har 1 rad per user+platform.
    // Vill du binda till user_id: lägg till userId och filtrera i queryn.
    const supaRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_recurring_platforms?select=platform,autoaffi_user_code`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        cache: "no-store"
      }
    );

    if (!supaRes.ok) {
      console.error("[/api/recurring/platforms] Supabase error", await supaRes.text());
      return NextResponse.json(
        { ok: false, error: "Failed to load recurring platforms from Supabase" },
        { status: 500 }
      );
    }

    const rows = (await supaRes.json()) as {
      platform: string;
      autoaffi_user_code: string | null;
    }[];

    // Gör map: platformId -> subId
    const subIdMap = new Map<string, string | null>();
    for (const row of rows) {
      if (!row?.platform) continue;
      subIdMap.set(row.platform, row.autoaffi_user_code ?? null);
    }

    // Bygg slutlig lista
    const platforms = BASE_PLATFORMS.map((p) => {
      const subId = subIdMap.get(p.id) ?? null;
      const affiliateUrl = buildAffiliateUrl(p.id, subId);
      return {
        ...p,
        subId,
        affiliateUrl
      };
    });

    return NextResponse.json(
      {
        ok: true,
        platforms
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/recurring/platforms] Crash:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}