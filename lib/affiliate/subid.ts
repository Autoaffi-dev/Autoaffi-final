import crypto from "crypto";

/**
 * Autoaffi Product SubId (BEAST LOCKED)
 * - Unique per user + source + product (+ optional placement)
 * - Deterministic: same inputs -> same subid
 * - Safe charset: [a-z0-9_]
 * - Short: default <= 64 chars (network-safe)
 *
 * Format:
 *   aa_p_<hash>__u_<userShort>__s_<source>__p_<productShort>__pl_<placement?>
 *
 * NOTE:
 * - This is for PRODUCT networks (awin/cj/warriorplus/aliexpress/rakuten).
 * - Recurring platforms keep their OWN subid system (user_recurring_platforms.autoaffi_user_code).
 */

export type ProductNetworkSource =
  | "awin"
  | "cj"
  | "warriorplus"
  | "aliexpress"
  | "rakuten"
  | "impact"; // if used for product-mode later

export type ProductPlacement =
  | "affiliate_offers"
  | "reels"
  | "posts"
  | "campaigns"
  | "other";

type BuildSubIdArgs = {
  userId: string;                // Supabase auth user id (uuid)
  source: ProductNetworkSource;  // network source for product
  externalId: string;            // product_index.external_id
  placement?: ProductPlacement;  // optional: where link was generated from
  offerKey?: string | null;      // optional: your internal offer key if you have one
};

function sha1(input: string) {
  return crypto.createHash("sha1").update(input, "utf8").digest("hex");
}

function safeToken(input: string, maxLen: number) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!s) return "x";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function shortUser(userId: string) {
  // stable short user token without leaking full uuid
  // use last 10 chars (uuid is mostly random anyway) + safe-token
  const u = String(userId || "").trim();
  if (!u) return "u_x";
  const tail = u.replace(/[^a-f0-9-]/gi, "").slice(-10);
  return safeToken(tail || u, 12);
}

function shortProduct(externalId: string) {
  // keep it short but stable and readable
  return safeToken(externalId, 24);
}

/**
 * Build deterministic subid for product network links.
 * Returns a compact string safe for query params.
 */
export function buildProductSubId(args: BuildSubIdArgs): string {
  const userId = String(args.userId || "").trim();
  const source = String(args.source || "").trim() as ProductNetworkSource;
  const externalId = String(args.externalId || "").trim();

  if (!userId || !source || !externalId) {
    // hard fail in dev; in prod return safe fallback
    if (process.env.NODE_ENV !== "production") {
      throw new Error("buildProductSubId missing userId/source/externalId");
    }
    return "aa_p_fallback";
  }

  const placement = (args.placement || "other") as ProductPlacement;
  const offerKey = args.offerKey ? String(args.offerKey).trim() : "";

  const uShort = shortUser(userId);
  const pShort = shortProduct(externalId);
  const sShort = safeToken(source, 16);
  const plShort = safeToken(placement, 16);

  // deterministic hash core (prevents collisions + keeps privacy)
  const core = `u=${userId}|s=${source}|p=${externalId}|pl=${placement}|k=${offerKey}`;
  const h = sha1(core).slice(0, 18); // short but safe for uniqueness

  // Final subid
  // Keep <= ~120 chars worst case; typically ~70-95
  const subid = `aa_p_${h}__u_${uShort}__s_${sShort}__p_${pShort}__pl_${plShort}`;

  return subid.length > 120 ? subid.slice(0, 120) : subid;
}

/**
 * Optional helper: parse pieces (best-effort)
 */
export function parseProductSubId(subid: string): {
  hash?: string;
  userShort?: string;
  source?: string;
  productShort?: string;
  placement?: string;
} {
  const s = String(subid || "").trim();
  if (!s) return {};
  const out: any = {};
  const parts = s.split("__").map((x) => x.trim()).filter(Boolean);

  for (const p of parts) {
    if (p.startsWith("aa_p_")) out.hash = p.replace("aa_p_", "");
    else if (p.startsWith("u_")) out.userShort = p.replace("u_", "");
    else if (p.startsWith("s_")) out.source = p.replace("s_", "");
    else if (p.startsWith("p_")) out.productShort = p.replace("p_", "");
    else if (p.startsWith("pl_")) out.placement = p.replace("pl_", "");
  }
  return out;
}
