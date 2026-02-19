import crypto from "crypto";

/**
 * WarriorPlus Connect-style sync via API:
 * - Uses /api/v2/affiliate_requests (single source of truth for approvals)
 * - Returns records indexer can upsert into product_index
 *
 * ENV:
 * - WARRIORPLUS_API_KEY=xxxxxxxx
 * - WARRIORPLUS_BASE_URL=https://warriorplus.com (optional)
 */

type WpAffiliateRequest = {
  id?: string;
  status?: string;
  promote_url?: string;

  offer?: {
    id?: string;
    title?: string;
    name?: string;
    description?: string;
    price?: string | number;
    currency?: string;
    category?: string;
    image_url?: string;
  };

  vendor_name?: string;
  vendor_username?: string;
};

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function toNumberOrNull(v: any): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function baseUrl() {
  return (process.env.WARRIORPLUS_BASE_URL || "https://warriorplus.com").replace(/\/+$/, "");
}

function requireApiKey() {
  const k = process.env.WARRIORPLUS_API_KEY;
  if (!k) throw new Error("Missing WARRIORPLUS_API_KEY in env.");
  return k;
}

async function wpGet(path: string, params: Record<string, string>) {
  const url = new URL(baseUrl() + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(`WarriorPlus API error ${res.status}: ${text.slice(0, 500)}`);
  }

  if (json && typeof json === "object" && json.success === 0) {
    throw new Error(json?.errors?.message ?? "WarriorPlus API returned success=0");
  }

  return json ?? {};
}

function normalizeStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function isApprovedStatus(status: string) {
  return status === "active" || status === "approved" || status === "accepted";
}

export async function fetchProducts({ limit = 200 }: { limit?: number }) {
  const apiKey = requireApiKey();
  const pageSize = Math.max(1, Math.min(100, limit));

  const json = await wpGet("/api/v2/affiliate_requests/", {
    apiKey,
    limit: String(pageSize),
  });

  const data: WpAffiliateRequest[] =
    (json?.data as any[]) ||
    (json?.affiliate_requests as any[]) ||
    (Array.isArray(json) ? (json as any[]) : []);

  if (!Array.isArray(data) || data.length === 0) return [];

  const out: any[] = [];

  for (const item of data) {
    const status = normalizeStatus(item?.status);
    const approved = isApprovedStatus(status);

    const promoteUrl = String(item?.promote_url ?? "").trim();
    if (!promoteUrl) continue;
    if (!approved) continue;

    const offer = item?.offer ?? {};
    const title = String(offer?.title ?? offer?.name ?? "WarriorPlus Offer").trim();

    const descriptionRaw = String(offer?.description ?? "").trim();

    const vendorName = String(item?.vendor_name ?? "").trim();
    const vendorUser = String(item?.vendor_username ?? "").trim();

    const vendorBits = [
      vendorName ? `Vendor: ${vendorName}` : null,
      vendorUser ? `@${vendorUser}` : null,
    ].filter(Boolean);

    const description =
      (descriptionRaw ? descriptionRaw : "Approved WarriorPlus offer (Autoaffi master).") +
      (vendorBits.length ? ` • ${vendorBits.join(" ")}` : "");

    // external_id: prefer offer.id (stable), else fallback id/hash
    const external_id =
      String(offer?.id ?? "").trim() ||
      String(item?.id ?? "").trim() ||
      `wp_${sha1(promoteUrl).slice(0, 12)}`;

    // Baseline score (WP approvals are already a quality gate)
    const quality_score = 70;

    out.push({
      source: "warriorplus",
      external_id,
      title,
      description,
      category: offer?.category ?? "warriorplus",
      product_url: promoteUrl,
      landing_url: promoteUrl,
      image_url: offer?.image_url ?? null,
      currency: offer?.currency ?? "USD",
      price: toNumberOrNull(offer?.price),

      // Merchant (helps caps + debug)
      merchant_name: vendorName || (vendorUser ? `@${vendorUser}` : null),
      merchant_id: vendorUser ? `wp_${vendorUser}` : null,

      is_approved: true,
      is_active: true,
      quality_score,
      score: quality_score,
      geo_scope: "worldwide",
      winner_tier: "B",
    });

    if (out.length >= limit) break;
  }

  // dedupe
  const seen = new Set<string>();
  const unique = out.filter((p) => {
    const key = `${p.source}:${p.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, limit);
}

export default fetchProducts;