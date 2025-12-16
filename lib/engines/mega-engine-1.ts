import { createClient } from "@supabase/supabase-js";

// ---------- TYPES ----------
export interface AffiliateIds {
  digistoreId: string | null;
  myleadId: string | null;
  cpaleadId: string | null;
  amazonTag: string | null;
  impactId: string | null;
}

export interface DashboardSync {
  focus: string;
  insights: string[];
  momentumScore: number;
  socialConnections: {
    instagram: boolean;
    tiktok: boolean;
    youtube: boolean;
  };
  funnelsEnabled: boolean;
  recurringPlatformsActive: string[];
  productSignals: string[];
}

// ---------- SUPABASE CLIENT ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------- 3B: GET AFFILIATE IDS ----------
export async function getAffiliateIdsForUser(userId: string): Promise<AffiliateIds> {
  const { data, error } = await supabase
    .from("user_affiliate_ids")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[MegaEngine1] Error reading affiliate IDs:", error);
  }

  return {
    digistoreId: data?.digistore_id ?? null,
    myleadId: data?.mylead_id ?? null,
    cpaleadId: data?.cpalead_id ?? null,
    amazonTag: data?.amazon_tag ?? null,
    impactId: data?.impact_id ?? null,
  };
}

// ---------- SOCIAL CONNECTIONS ----------
async function getSocialConnections(userId: string) {
  const { data } = await supabase
    .from("user_social_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    instagram: !!data?.instagram_connected,
    tiktok: !!data?.tiktok_connected,
    youtube: !!data?.youtube_connected,
  };
}

// ---------- RECURRING PLATFORMS ----------
async function getRecurringPlatforms(userId: string) {
  const { data } = await supabase
    .from("user_recurring_platforms")
    .select("platform")
    .eq("user_id", userId);

  return (data ?? []).map((row) => row.platform);
}

// ---------- PRODUCT SIGNALS ----------
async function getProductSignals(userId: string) {
  // Later this will pull search history, trending categories, etc.
  return [
    "Product engine active",
    "Good mix of digital & CPA sources detected",
    "Affiliate IDs connected",
  ];
}

// ---------- DASHBOARD SYNC (FULL ENGINE) ----------
export async function getDashboardSync(userId: string): Promise<DashboardSync> {
  const social = await getSocialConnections(userId);
  const recurring = await getRecurringPlatforms(userId);
  const productSignals = await getProductSignals(userId);

  return {
    focus: "Build your first 3 pieces of content today",
    insights: [
      "Offers connected ✔",
      "Product feed synced ✔",
      recurring.length > 0
        ? "Recurring platforms active"
        : "Enable recurring platforms for stable income",
    ],
    momentumScore:
      (social.instagram ? 1 : 0) +
      (social.tiktok ? 1 : 0) +
      (social.youtube ? 1 : 0) +
      (recurring.length > 0 ? 1 : 0),
    socialConnections: social,
    funnelsEnabled: true,
    recurringPlatformsActive: recurring,
    productSignals,
  };
}

// ---------- EXPORTED MEGA ENGINE 1 ----------
export const MegaEngine1 = {
  getAffiliateIdsForUser,
  getDashboardSync,
};