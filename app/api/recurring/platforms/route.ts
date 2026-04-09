import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PlatformKey =
  | "syllaby"
  | "submagic"
  | "simplified"
  | "fliki"
  | "dfirst"
  | "tubemagic"
  | "systeme"
  | "clickfunnels"
  | "minea"
  | "justcall"
  | "heygen";

type PlatformState = {
  key: PlatformKey;
  active: boolean;
  tracking_code: string | null;
  promo_link: string | null;
  updated_at?: string | null;
};

function jsonNoStore(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function genCode8() {
  // 8 chars, lower-case a-z0-9, safe for platforms with short limits
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildPromoLink(platform: PlatformKey, tracking: string, userId: string) {
  // You can move these into env vars later. Keep it explicit for reliability.
  switch (platform) {
    // FirstPromoter-style (we verified: Syllaby uses fp_sid)
    case "syllaby":
      return `https://syllaby.io/?via=autoaffi31&fp_sid=${tracking}`;

    case "submagic":
      // Submagic also supports Sub ID. Most FP programs accept fp_sid.
      // If Submagic uses a different param later, adjust here ONLY.
      return `https://www.submagic.co/?via=autoaffi&fp_sid=${tracking}`;

    case "simplified":
      return `https://simplified.com/?fp_sid=${tracking}`;

    // Fliki uses via=token (verified)
    case "fliki":
      return `https://fliki.ai/?via=${tracking}`;

    // DFIRST uses ref=token (verified)
    case "dfirst":
      return `https://dfirst.ai/?ref=${tracking}`;

    // Digistore24 custom domain flow for TubeMagic (verified)
    case "tubemagic": {
      const AFF = process.env.TUBEMAGIC_AFFILIATE || "AutoAffi";
      return `https://tubemagic.com/ds#aff=${encodeURIComponent(AFF)}&cam=${encodeURIComponent(tracking)}`;
    }

    // These two should ideally go through Autoaffi /go redirect for robustness
    case "systeme": {
      // tk can be packed; simplest: use tracking and let /go pack later
      // Replace MASTER_ID once you store it centrally
      const MASTER = process.env.SYSTEME_MASTER_ID || "MASTER_ID_MISSING";
      return `https://systeme.io/?sa=${encodeURIComponent(MASTER)}&tk=${encodeURIComponent(tracking)}`;
    }

    case "clickfunnels": {
      const AFF = process.env.CLICKFUNNELS_AFF_CODE || "AFF_CODE_MISSING";
      const SIGNUP = process.env.CLICKFUNNELS_SIGNUP_FLOW_URL || "https://www.clickfunnels.com/";
      // Use tracking in aff_sub. You can also add aff_sub2/3 later.
      const sep = SIGNUP.includes("?") ? "&" : "?";
      return `${SIGNUP}${sep}aff=${encodeURIComponent(AFF)}&aff_sub=${encodeURIComponent(tracking)}`;
    }

    // For anything uncertain, route via Autoaffi /go and keep tracking internal.
    // You can later swap to direct param models if partner confirms.
    case "minea":
      return `https://www.minea.com/?via=autoaffi&aa=${tracking}`; // safe placeholder (Autoaffi can also /go)
    case "justcall":
      return `https://justcall.io/?aa=${tracking}`;
    case "heygen":
      return `https://www.heygen.com/?aa=${tracking}`;

    default:
      return null;
  }
}

async function requireUserId() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) return null;
  return userId;
}

const ALL_PLATFORMS: PlatformKey[] = [
  "syllaby",
  "submagic",
  "simplified",
  "fliki",
  "dfirst",
  "tubemagic",
  "systeme",
  "clickfunnels",
  "minea",
  "justcall",
  "heygen",
];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonNoStore({ error: "Unauthorized" }, 401);

  const { data, error } = await supabaseAdmin
    .from("user_recurring_offers")
    .select("platform, active, tracking_code, promo_link, updated_at")
    .eq("user_id", userId);

  if (error) return jsonNoStore({ error: error.message }, 500);

  const map: Record<string, PlatformState> = {};
  for (const p of ALL_PLATFORMS) {
    map[p] = { key: p, active: false, tracking_code: null, promo_link: null };
  }

  for (const row of data ?? []) {
    const key = row.platform as PlatformKey;
    if (!map[key]) continue;
    map[key] = {
      key,
      active: !!row.active,
      tracking_code: row.tracking_code ?? null,
      promo_link: row.promo_link ?? null,
      updated_at: row.updated_at ?? null,
    };
  }

  return jsonNoStore({ platforms: map });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonNoStore({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const platform = body?.platform as PlatformKey | undefined;
  const active = body?.active as boolean | undefined;

  if (!platform || typeof active !== "boolean") {
    return jsonNoStore({ error: "Bad request" }, 400);
  }
  if (!ALL_PLATFORMS.includes(platform)) {
    return jsonNoStore({ error: "Unknown platform" }, 400);
  }

  // Fetch existing
  const existing = await supabaseAdmin
    .from("user_recurring_offers")
    .select("active, tracking_code, promo_link")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") {
    return jsonNoStore({ error: existing.error.message }, 500);
  }

  let tracking = existing.data?.tracking_code ?? null;
  let promo = existing.data?.promo_link ?? null;

  // On activate: ensure tracking + link exist
  if (active) {
    if (!tracking) tracking = genCode8();
    promo = buildPromoLink(platform, tracking, userId);
  }

  const upsertPayload = {
    user_id: userId,
    platform,
    active,
    tracking_code: tracking,
    promo_link: promo,
  };

  const { data, error } = await supabaseAdmin
    .from("user_recurring_offers")
    .upsert(upsertPayload, { onConflict: "user_id,platform" })
    .select("platform, active, tracking_code, promo_link, updated_at")
    .single();

  if (error) return jsonNoStore({ error: error.message }, 500);

  const result: PlatformState = {
    key: platform,
    active: !!data.active,
    tracking_code: data.tracking_code ?? null,
    promo_link: data.promo_link ?? null,
    updated_at: data.updated_at ?? null,
  };

  return jsonNoStore({ platform: result });
}