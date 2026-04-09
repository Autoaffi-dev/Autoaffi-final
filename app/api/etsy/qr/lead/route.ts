import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function cleanStr(v: any, max = 200) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizeEmail(v: any) {
  const s = cleanStr(v, 180);
  return s ? s.toLowerCase() : null;
}

function mergeMessage(existing: string | null, incoming: string | null) {
  const ex = (existing || "").trim();
  const inc = (incoming || "").trim();

  if (!ex && !inc) return null;
  if (!ex) return inc.slice(0, 1500);
  if (!inc) return ex.slice(0, 1500);

  if (ex.includes(inc)) return ex.slice(0, 1500);

  const merged = `${ex}\n\n---\n\n${inc}`;
  return merged.slice(0, 1500);
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function allowDevHeader(req: Request) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const isLocalhost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  return process.env.NODE_ENV !== "production" && isLocalhost;
}

async function requireUserId(req: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session as any)?.user?.id ? String((session as any).user.id) : "";
  if (sessionUserId.trim()) return sessionUserId.trim();

  if (allowDevHeader(req)) {
    const h = (req.headers.get("x-autoaffi-user-id") || "").trim();
    if (h) return h;
  }

  return null;
}

type ProductType = "hoodie" | "sticker" | "phonecase";

type LeadRowJoined = {
  id: number;
  asset_id: string | null;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  ts?: string | null;
  source_type?: string | null;
  source_token?: string | null;

  user_qr_assets?: { product_type?: ProductType | null; token?: string | null } | null;
};

type ResolvedLeadOwner =
  | {
      kind: "qr_asset";
      user_id: string;
      asset_id: string;
      token: string;
      destination_mode: string | null;
      destination_url: string | null;
      product_type: ProductType | null;
      continue_url: string;
    }
  | {
      kind: "profile_connect";
      user_id: string;
      asset_id: null;
      token: string;
      destination_mode: "profile_connect";
      destination_url: string | null;
      product_type: null;
      continue_url: string | null;
      slug: string;
      offer_key: string | null;
      platform: string | null;
    };

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function resolveQrAssetOwner(supabase: ReturnType<typeof getAdminSupabase>, token: string) {
  const { data: asset, error: assetErr } = await supabase
    .from("user_qr_assets")
    .select("id,user_id,token,destination_mode,destination_url,product_type,slug")
    .or(`token.eq.${token},slug.eq.${token}`)
    .maybeSingle();

  if (assetErr) {
    throw new Error(`ASSET_LOOKUP_FAILED: ${assetErr.message}`);
  }

  if (!asset) return null;

  return {
    kind: "qr_asset" as const,
    user_id: asset.user_id,
    asset_id: asset.id,
    token: asset.token || token,
    destination_mode: asset.destination_mode || null,
    destination_url: asset.destination_url || null,
    product_type: (asset.product_type || null) as ProductType | null,
    continue_url: `/go/${encodeURIComponent(asset.token || token)}?to=affiliate&skip_log=1`,
  };
}

async function resolveProfileConnectOwner(
  supabase: ReturnType<typeof getAdminSupabase>,
  token: string
) {
  const { data: stateRows, error } = await supabase
    .from("profile_connect_state")
    .select("user_id, platform, state_json, updated_at");

  if (error) {
    throw new Error(`PROFILE_CONNECT_LOOKUP_FAILED: ${error.message}`);
  }

  for (const row of stateRows || []) {
    const state = safeJsonParse<Record<string, any>>(row?.state_json, {});
    const slug = String(state?.slug || state?.link?.slug || state?.offer_key || "").trim();
    const offerKey = cleanStr(state?.offer_key, 120);

    if (slug === token || offerKey === token) {
      return {
        kind: "profile_connect" as const,
        user_id: String(row.user_id),
        asset_id: null,
        token,
        destination_mode: "profile_connect" as const,
        destination_url: cleanStr(
          state?.link?.primary_link_url || state?.reply_context?.main_link,
          1000
        ),
        product_type: null,
        continue_url: null,
        slug: slug || token,
        offer_key: offerKey,
        platform: cleanStr(row.platform, 40),
      };
    }
  }

  return null;
}

async function resolveLeadOwner(
  supabase: ReturnType<typeof getAdminSupabase>,
  token: string
): Promise<ResolvedLeadOwner | null> {
  const qrOwner = await resolveQrAssetOwner(supabase, token);
  if (qrOwner) return qrOwner;

  const profileOwner = await resolveProfileConnectOwner(supabase, token);
  if (profileOwner) return profileOwner;

  return null;
}

/**
 * ✅ GET /api/etsy/qr/lead?days=30&limit=50&cursor=<ISO>
 */
export async function GET(req: Request) {
  const supabase = getAdminSupabase();

  const userId = await requireUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const daysRaw = parseInt(url.searchParams.get("days") || "30", 10);
  const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10);
  const cursor = url.searchParams.get("cursor");

  const days = clampInt(Number.isFinite(daysRaw) ? daysRaw : 30, 1, 365);
  const limit = clampInt(Number.isFinite(limitRaw) ? limitRaw : 50, 1, 200);

  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase
    .from("qr_leads")
    .select("id,asset_id,user_id,name,email,phone,message,ts,source_type,source_token,user_qr_assets(product_type,token)")
    .eq("user_id", userId)
    .gte("ts", fromDate)
    .order("ts", { ascending: false })
    .limit(limit + 1);

  if (cursor) q = q.lt("ts", cursor);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { ok: false, error: "LEADS_FETCH_FAILED", details: error.message },
      { status: 500 }
    );
  }

  const rows = (data || []) as LeadRowJoined[];
  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  const next_cursor = hasMore && sliced.length ? sliced[sliced.length - 1].ts || null : null;

  const items = sliced.map((r) => ({
    id: r.id,
    asset_id: r.asset_id,
    user_id: r.user_id,
    name: r.name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    message: r.message ?? null,
    ts: r.ts ?? null,
    source:
      (r.user_qr_assets?.product_type ?? null) ||
      (r.source_type ?? null),
    token:
      (r.user_qr_assets?.token ?? null) ||
      (r.source_token ?? null),
  }));

  const counts: Record<string, number> = {};
  for (const it of items) {
    const s = it.source || "unknown";
    counts[s] = (counts[s] || 0) + 1;
  }

  const top_sources = Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    ok: true,
    days,
    from: fromDate,
    next_cursor,
    items,
    top_sources,
    total_in_window: items.length,
  });
}

/**
 * ✅ POST /api/etsy/qr/lead
 * - Supports BOTH old QR/Etsy tokens and new Profile Setup tokens
 */
export async function POST(req: Request) {
  const supabase = getAdminSupabase();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const token = cleanStr(body?.token, 120);
  const name = cleanStr(body?.name, 120);
  const email = normalizeEmail(body?.email);
  const phone = cleanStr(body?.phone, 60);
  const message = cleanStr(body?.message, 500);
  const mode = cleanStr(body?.mode, 30);
  const next = cleanStr(body?.next, 1000);
  const sourceContext = cleanStr(body?.source_context, 80);
  const entryFlow = cleanStr(body?.entry_flow, 80);

  if (!token) {
    return NextResponse.json({ ok: false, error: "MISSING_TOKEN" }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json(
      { ok: false, error: "MISSING_CONTACT", details: "email or phone is required" },
      { status: 400 }
    );
  }

  let owner: ResolvedLeadOwner | null = null;
  try {
    owner = await resolveLeadOwner(supabase, token);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "OWNER_LOOKUP_FAILED", details: e?.message || "UNKNOWN" },
      { status: 500 }
    );
  }

  if (!owner) {
    return NextResponse.json({ ok: false, error: "TOKEN_NOT_FOUND", token }, { status: 404 });
  }

  const leadPayload = {
    asset_id: owner.asset_id,
    user_id: owner.user_id,
    name,
    email,
    phone,
    message,
    source_type: owner.kind === "qr_asset" ? owner.product_type || "qr_asset" : "profile_connect",
    source_token: token,
    source_context: sourceContext,
    entry_flow: entryFlow,
    mode: mode,
    next_url: next,
  };

  const { error: leadErr } = await supabase.from("qr_leads").insert(leadPayload);

  if (!leadErr) {
    return NextResponse.json({
      ok: true,
      merged: false,
      owner_type: owner.kind,
      destination_mode: owner.destination_mode,
      continue_url: owner.continue_url,
    });
  }

  const pgCode = (leadErr as any)?.code;
  if (pgCode !== "23505") {
    return NextResponse.json(
      { ok: false, error: "LEAD_INSERT_FAILED", details: leadErr.message },
      { status: 500 }
    );
  }

  let rowsQuery = supabase
    .from("qr_leads")
    .select("id,asset_id,user_id,name,email,phone,message,ts,source_type,source_token")
    .eq("user_id", owner.user_id)
    .eq("source_token", token)
    .order("ts", { ascending: false })
    .limit(50);

  if (owner.asset_id) {
    rowsQuery = supabase
      .from("qr_leads")
      .select("id,asset_id,user_id,name,email,phone,message,ts,source_type,source_token")
      .eq("asset_id", owner.asset_id)
      .order("ts", { ascending: false })
      .limit(50);
  }

  const { data: rows, error: rowsErr } = await rowsQuery;

  if (rowsErr) {
    return NextResponse.json(
      {
        ok: true,
        merged: false,
        duplicate: true,
        owner_type: owner.kind,
        destination_mode: owner.destination_mode,
        continue_url: owner.continue_url,
      },
      { status: 200 }
    );
  }

  const list = (rows || []) as Array<{
    id: number;
    asset_id: string | null;
    user_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    ts?: string | null;
    source_type?: string | null;
    source_token?: string | null;
  }>;

  const emailNorm = email ? email.toLowerCase() : null;
  const phoneNorm = phone ? phone : null;

  const matchByEmail = emailNorm
    ? list.find((r) => (r.email || "").toLowerCase() === emailNorm)
    : null;
  const matchByPhone = phoneNorm
    ? list.find((r) => (r.phone || "") === phoneNorm)
    : null;

  const target = matchByEmail || matchByPhone;

  if (!target) {
    return NextResponse.json(
      {
        ok: true,
        merged: false,
        duplicate: true,
        owner_type: owner.kind,
        destination_mode: owner.destination_mode,
        continue_url: owner.continue_url,
      },
      { status: 200 }
    );
  }

  const nextName = target.name || name || null;
  const nextEmail = target.email ? target.email.toLowerCase() : emailNorm || null;
  const nextPhone = target.phone || phoneNorm || null;
  const nextMessage = mergeMessage(target.message, message);

  const hasChange =
    nextName !== (target.name || null) ||
    nextEmail !== (((target.email || null)?.toLowerCase()) || null) ||
    nextPhone !== (target.phone || null) ||
    nextMessage !== (target.message || null);

  if (!hasChange) {
    return NextResponse.json(
      {
        ok: true,
        merged: false,
        duplicate: true,
        lead_id: target.id,
        owner_type: owner.kind,
        destination_mode: owner.destination_mode,
        continue_url: owner.continue_url,
      },
      { status: 200 }
    );
  }

  const { error: updErr } = await supabase
    .from("qr_leads")
    .update({
      name: nextName,
      email: nextEmail,
      phone: nextPhone,
      message: nextMessage,
    })
    .eq("id", target.id);

  if (updErr) {
    return NextResponse.json(
      {
        ok: true,
        merged: false,
        duplicate: true,
        lead_id: target.id,
        owner_type: owner.kind,
        destination_mode: owner.destination_mode,
        continue_url: owner.continue_url,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      merged: true,
      lead_id: target.id,
      owner_type: owner.kind,
      destination_mode: owner.destination_mode,
      continue_url: owner.continue_url,
    },
    { status: 200 }
  );
}