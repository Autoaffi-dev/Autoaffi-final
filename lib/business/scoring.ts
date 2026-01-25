import { NormalizedBusinessTarget, ScoreResult } from "./types";

const clampWhy = (why: string[]) => why.slice(0, 3);

const hasWebsite = (t: NormalizedBusinessTarget) => !!t.website || !!t.domain;
const hasPhone = (t: NormalizedBusinessTarget) => !!t.phone;

function partnerFitScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  const hay = `${t.category ?? ""} ${t.name ?? ""}`.toLowerCase();

  // "Best fit" buckets we agreed on: agencies/consultants/coaches/communities, etc.
  const hotKeywords = [
    "agency",
    "marketing",
    "seo",
    "web",
    "studio",
    "consult",
    "coach",
    "course",
    "academy",
    "community",
    "cowork",
    "it",
    "msp",
    "accounting",
    "bookkeeping",
    "recruit",
    "hr",
    "software",
    "saas",
    "growth",
    "partners",
  ];

  const warmKeywords = [
    "gym",
    "fitness",
    "clinic",
    "dental",
    "salon",
    "spa",
    "restaurant",
    "hotel",
    "real estate",
    "law",
    "plumber",
    "electric",
    "roof",
    "clean",
    "car",
    "detailing",
  ];

  if (hotKeywords.some((k) => hay.includes(k))) {
    return { points: 5, why: "Partner-fit: High (referral-friendly business)" };
  }

  if (warmKeywords.some((k) => hay.includes(k))) {
    return { points: 3, why: "Partner-fit: Medium (could work with right angle)" };
  }

  return { points: 1, why: "Partner-fit: Low/Unknown (needs better targeting)" };
}

function digitalPresenceScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  if (hasWebsite(t) && (t.rating ?? 0) >= 4.3) {
    return { points: 4, why: "Strong digital presence (website + good rating)" };
  }
  if (hasWebsite(t)) {
    return { points: 2, why: "Digital presence: Website found" };
  }
  return { points: 0, why: "Digital presence: No website detected" };
}

function contactQualityScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  // V1: we only know phone/site. People/contact roles come later via enrichment.
  if (hasWebsite(t) && hasPhone(t)) {
    return { points: 3, why: "Contact quality: Website + phone available" };
  }
  if (hasWebsite(t) || hasPhone(t)) {
    return { points: 1, why: "Contact quality: Limited (one channel)" };
  }
  return { points: 0, why: "Contact quality: Missing direct contact channels" };
}

function intentProxyScore(t: NormalizedBusinessTarget): { points: number; why?: string } {
  const hay = `${t.category ?? ""} ${t.name ?? ""}`.toLowerCase();
  // Proxy for intent: keywords that suggest growth/partners/marketing-minded orgs
  const intent = ["partners", "partnership", "affiliate", "referral", "growth", "marketing", "saas", "software"];
  if (intent.some((k) => hay.includes(k))) {
    return { points: 3, why: "Intent proxy: Growth/partner signals detected" };
  }
  return { points: 1, why: "Intent proxy: No clear signals" };
}

export function scoreTarget(t: NormalizedBusinessTarget): ScoreResult {
  const why: string[] = [];

  const pf = partnerFitScore(t);
  const dp = digitalPresenceScore(t);
  const cq = contactQualityScore(t);
  const ip = intentProxyScore(t);

  if (pf.why) why.push(pf.why);
  if (dp.why) why.push(dp.why);
  if (cq.why) why.push(cq.why);
  if (ip.why) why.push(ip.why);

  const score = pf.points + dp.points + cq.points + ip.points;

  // Status thresholds (as agreed)
  let status: ScoreResult["status"] = "COLD";
  if (score >= 10) status = "HOT";
  else if (score >= 6) status = "WARM";

  return { status, score, why: clampWhy(why) };
}