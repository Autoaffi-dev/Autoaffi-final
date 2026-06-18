import { NormalizedBusinessTarget, ScoreResult } from "./types";

const clampWhy = (why: string[]) => why.filter(Boolean).slice(0, 3);

const hasWebsite = (t: NormalizedBusinessTarget) => !!t.website || !!t.domain;
const hasPhone = (t: NormalizedBusinessTarget) => !!t.phone;

function buildHaystack(t: NormalizedBusinessTarget) {
  return `${t.category ?? ""} ${t.name ?? ""}`.toLowerCase();
}

function partnerFitScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  const hay = buildHaystack(t);

  // High-fit: likely to understand partnerships / growth / referrals faster
  const highKeywords = [
    "agency",
    "marketing",
    "seo",
    "web",
    "studio",
    "consult",
    "consulting",
    "coach",
    "course",
    "academy",
    "community",
    "cowork",
    "software",
    "saas",
    "growth",
    "partners",
    "partner",
    "it",
    "msp",
    "accounting",
    "bookkeeping",
    "recruit",
    "recruitment",
    "hr",
    "media",
    "creative",
    "branding",
    "design",
  ];

  // Medium-fit: can still work well with the right angle
  const mediumKeywords = [
    "gym",
    "fitness",
    "clinic",
    "dental",
    "salon",
    "spa",
    "restaurant",
    "bistro",
    "cafe",
    "bar",
    "hotel",
    "real estate",
    "law",
    "plumber",
    "electric",
    "roof",
    "clean",
    "car",
    "detailing",
    "beauty",
    "health",
    "wellness",
  ];

  if (highKeywords.some((k) => hay.includes(k))) {
    return { points: 5, why: "Partner-fit: High (referral-friendly business)" };
  }

  if (mediumKeywords.some((k) => hay.includes(k))) {
    return { points: 3, why: "Partner-fit: Medium (could work with right angle)" };
  }

  return { points: 1, why: "Partner-fit: Low/Unknown (needs better targeting)" };
}

function digitalPresenceScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  const rating = Number(t.rating ?? 0);

  if (hasWebsite(t) && rating >= 4.3) {
    return { points: 4, why: "Strong digital presence (website + good rating)" };
  }

  if (hasWebsite(t) && rating > 0) {
    return { points: 3, why: "Good digital presence (website + public profile)" };
  }

  if (hasWebsite(t)) {
    return { points: 2, why: "Digital presence: Website found" };
  }

  return { points: 0, why: "Digital presence: No website detected" };
}

function contactQualityScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  if (hasWebsite(t) && hasPhone(t)) {
    return { points: 3, why: "Contact quality: Website + phone available" };
  }

  if (hasWebsite(t) || hasPhone(t)) {
    return { points: 1, why: "Contact quality: Limited (one channel)" };
  }

  return { points: 0, why: "Contact quality: Missing direct contact channels" };
}

function intentProxyScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  const hay = buildHaystack(t);

  const intentKeywords = [
    "partners",
    "partnership",
    "affiliate",
    "referral",
    "growth",
    "marketing",
    "saas",
    "software",
    "community",
    "academy",
    "studio",
    "creative",
  ];

  if (intentKeywords.some((k) => hay.includes(k))) {
    return { points: 3, why: "Intent proxy: Growth/partner signals detected" };
  }

  return { points: 1, why: "Intent proxy: No clear signals" };
}

function sizeHintAdjustment(t: NormalizedBusinessTarget): { points: number; why?: string } {
  if (t.sizeHint === "LARGE") {
    return { points: 1, why: "Scale signal: Larger organization" };
  }

  if (t.sizeHint === "SMALL") {
    return { points: 0, why: "Scale signal: Smaller business" };
  }

  return { points: 0 };
}

export function scoreTarget(t: NormalizedBusinessTarget): ScoreResult {
  const why: string[] = [];

  const pf = partnerFitScore(t);
  const dp = digitalPresenceScore(t);
  const cq = contactQualityScore(t);
  const ip = intentProxyScore(t);
  const sz = sizeHintAdjustment(t);

  if (pf.why) why.push(pf.why);
  if (dp.why) why.push(dp.why);
  if (cq.why) why.push(cq.why);
  if (ip.why) why.push(ip.why);
  if (sz.why) why.push(sz.why);

  const score = pf.points + dp.points + cq.points + ip.points + sz.points;

  let status: ScoreResult["status"] = "COLD";
  if (score >= 10) status = "HOT";
  else if (score >= 6) status = "WARM";

  return {
    status,
    score,
    why: clampWhy(why),
  };
}