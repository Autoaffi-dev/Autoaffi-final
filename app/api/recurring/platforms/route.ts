import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PlatformKey =
  | "autoaffi"
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
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function buildPromoLink(platform: PlatformKey, tracking: string, userId: string) {
  switch (platform) {
    case "autoaffi": {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.QR_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000";

      return `${base.replace(/\/$/, "")}/?ref=${encodeURIComponent(tracking)}`;
    }

    case "syllaby":
      return `https://syllaby.io/?via=autoaffi31&fp_sid=${tracking}`;

    case "submagic":
      return `https://www.submagic.co/?via=autoaffi&fp_sid=${tracking}`;

    case "simplified":
      return `https://simplified.com/?fp_sid=${tracking}`;

    case "fliki":
      return `https://fliki.ai/?via=${tracking}`;

    case "dfirst":
      return `https://dfirst.ai/?ref=${tracking}`;

    case "tubemagic": {
      const AFF = process.env.TUBEMAGIC_AFFILIATE || "AutoAffi";
      return `https://tubemagic.com/ds#aff=${encodeURIComponent(
        AFF
      )}&cam=${encodeURIComponent(tracking)}`;
    }

    case "systeme": {
      const MASTER = process.env.SYSTEME_MASTER_ID || "MASTER_ID_MISSING";
      return `https://systeme.io/?sa=${encodeURIComponent(
        MASTER
      )}&tk=${encodeURIComponent(tracking)}`;
    }

    case "clickfunnels": {
      const AFF = process.env.CLICKFUNNELS_AFF_CODE || "AFF_CODE_MISSING";
      const SIGNUP =
        process.env.CLICKFUNNELS_SIGNUP_FLOW_URL ||
        "https://www.clickfunnels.com/";
      const sep = SIGNUP.includes("?") ? "&" : "?";
      return `${SIGNUP}${sep}aff=${encodeURIComponent(
        AFF
      )}&aff_sub=${encodeURIComponent(tracking)}`;
    }

    case "minea":
      return `https://www.minea.com/?via=autoaffi&aa=${tracking}`;

    case "justcall":
      return `https://justcall.io/?aa=${tracking}`;

    case "heygen":
      return `https://www.heygen.com/?aa=${tracking}`;

    default:
      return null;
  }
}

async function resolveUserIds(req: Request) {
  const hdr = sanitizeHeaderId(req.headers.get("x-autoaffi-user-id") || "");
  const devUuid = (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim();

  let resolvedUserId: string | null = null;
  if (isUuid(hdr)) resolvedUserId = hdr;
  else if (isUuid(devUuid)) resolvedUserId = devUuid;

  const session = await getServerSession(authOptions);
  const sessionUserId = ((session as any)?.user?.id as string | undefined) || null;

  if (!resolvedUserId && sessionUserId) resolvedUserId = sessionUserId;

  return {
    resolvedUserId,
    sessionUserId,
  };
}

const ALL_PLATFORMS: PlatformKey[] = [
  "autoaffi",
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

async function fetchExternalRows(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_recurring_offers")
    .select("platform, active, tracking_code, promo_link, updated_at")
    .eq("user_id", userId);

  return { data, error };
}

export async function GET(req: Request) {
  const { resolvedUserId, sessionUserId } = await resolveUserIds(req);
  if (!resolvedUserId) return jsonNoStore({ error: "Unauthorized" }, 401);

  const map: Record<string, PlatformState> = {};

  for (const p of ALL_PLATFORMS) {
    map[p] = {
      key: p,
      active: false,
      tracking_code: null,
      promo_link: null,
    };
  }

  // =====================================================
  // 1) AUTOAFFI – alltid från resolved user
  // =====================================================
  const { data: autoaffiRow, error: autoaffiErr } = await supabaseAdmin
    .from("user_recurring_platforms")
    .select("platform, autoaffi_user_code")
    .eq("user_id", resolvedUserId)
    .eq("platform", "autoaffi")
    .maybeSingle();

  if (autoaffiErr) {
    return jsonNoStore({ error: autoaffiErr.message }, 500);
  }

  if (autoaffiRow?.autoaffi_user_code) {
    const tracking = autoaffiRow.autoaffi_user_code;
    map.autoaffi = {
      key: "autoaffi",
      active: true,
      tracking_code: tracking,
      promo_link: buildPromoLink("autoaffi", tracking, resolvedUserId),
    };
  }

  // =====================================================
  // 2) EXTERNA – först resolved user
  // =====================================================
  let { data: externalRows, error: externalErr } = await fetchExternalRows(
    resolvedUserId
  );

  if (externalErr) {
    return jsonNoStore({ error: externalErr.message }, 500);
  }

  // Om inga externa hittas på resolved user men session user skiljer sig:
  const noExternalFound = !externalRows || externalRows.length === 0;
  const shouldTrySessionFallback =
    noExternalFound &&
    !!sessionUserId &&
    sessionUserId !== resolvedUserId;

  if (shouldTrySessionFallback) {
    const fallback = await fetchExternalRows(sessionUserId);
    if (fallback.error) {
      return jsonNoStore({ error: fallback.error.message }, 500);
    }
    externalRows = fallback.data ?? [];
  }

  for (const row of externalRows ?? []) {
    const key = row.platform as PlatformKey;
    if (!map[key]) continue;
    if (key === "autoaffi") continue;

    let promoLink = row.promo_link ?? null;

    if (!promoLink && row.tracking_code) {
      promoLink = buildPromoLink(key, row.tracking_code, resolvedUserId);
    }

    map[key] = {
      key,
      active: !!row.active,
      tracking_code: row.tracking_code ?? null,
      promo_link: promoLink,
      updated_at: row.updated_at ?? null,
    };
  }

  return jsonNoStore({ platforms: map });
}

export async function POST(req: Request) {
  const { resolvedUserId } = await resolveUserIds(req);
  if (!resolvedUserId) return jsonNoStore({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const platform = body?.platform as PlatformKey | undefined;
  const active = body?.active as boolean | undefined;

  if (!platform || typeof active !== "boolean") {
    return jsonNoStore({ error: "Bad request" }, 400);
  }

  if (!ALL_PLATFORMS.includes(platform)) {
    return jsonNoStore({ error: "Unknown platform" }, 400);
  }

  // =====================================================
  // AUTOAFFI – skriv till user_recurring_platforms
  // =====================================================
  if (platform === "autoaffi") {
    if (!active) {
      const { data: existing, error } = await supabaseAdmin
        .from("user_recurring_platforms")
        .select("platform, autoaffi_user_code")
        .eq("user_id", resolvedUserId)
        .eq("platform", "autoaffi")
        .maybeSingle();

      if (error) return jsonNoStore({ error: error.message }, 500);

      const code = existing?.autoaffi_user_code ?? null;

      return jsonNoStore({
        platform: {
          key: "autoaffi",
          active: !!code,
          tracking_code: code,
          promo_link: code
            ? buildPromoLink("autoaffi", code, resolvedUserId)
            : null,
        },
      });
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("user_recurring_platforms")
      .select("platform, autoaffi_user_code")
      .eq("user_id", resolvedUserId)
      .eq("platform", "autoaffi")
      .maybeSingle();

    if (existingErr) {
      return jsonNoStore({ error: existingErr.message }, 500);
    }

    let tracking = existing?.autoaffi_user_code ?? null;

    if (!tracking) {
      tracking = genCode8();

      const { error: insertErr } = await supabaseAdmin
        .from("user_recurring_platforms")
        .insert({
          user_id: resolvedUserId,
          platform: "autoaffi",
          autoaffi_user_code: tracking,
        });

      if (insertErr) {
        return jsonNoStore({ error: insertErr.message }, 500);
      }
    }

    const promo = buildPromoLink("autoaffi", tracking, resolvedUserId);

    return jsonNoStore({
      platform: {
        key: "autoaffi",
        active: true,
        tracking_code: tracking,
        promo_link: promo,
      },
    });
  }

  // =====================================================
  // EXTERNA – skriv till user_recurring_offers
  // =====================================================
  const existing = await supabaseAdmin
    .from("user_recurring_offers")
    .select("active, tracking_code, promo_link")
    .eq("user_id", resolvedUserId)
    .eq("platform", platform)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") {
    return jsonNoStore({ error: existing.error.message }, 500);
  }

  let tracking = existing.data?.tracking_code ?? null;
  let promo = existing.data?.promo_link ?? null;

  if (active) {
    if (!tracking) tracking = genCode8();
    promo = buildPromoLink(platform, tracking, resolvedUserId);
  }

  const upsertPayload = {
    user_id: resolvedUserId,
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