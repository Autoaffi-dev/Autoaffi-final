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

  // DEV header får aldrig råka fungera i prod
  return process.env.NODE_ENV !== "production" && isLocalhost;
}

async function requireUserId(req: Request): Promise<string | null> {
  // 1) Prod/normal: session
  const session = await getServerSession(authOptions);
  const sessionUserId = (session as any)?.user?.id ? String((session as any).user.id) : "";
  if (sessionUserId.trim()) return sessionUserId.trim();

  // 2) DEV fallback: tillåt header endast lokalt i dev
  if (allowDevHeader(req)) {
    const h = (req.headers.get("x-autoaffi-user-id") || "").trim();
    if (h) return h;
  }

  return null;
}

type ProductType = "hoodie" | "sticker" | "phonecase";

type LeadRowJoined = {
  id: number;
  asset_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  ts?: string | null;

  // join: user_qr_assets(product_type, token)
  user_qr_assets?: { product_type?: ProductType | null; token?: string | null } | null;
};

/**
 * ✅ GET /api/etsy/qr/lead?days=30&limit=50&cursor=<ISO>
 * - Kräver inloggning (session) i prod
 * - DEV header tillåts bara lokalt (localhost) i dev
 * - Returnerar items + top_sources (30d, baserat på det du frågar efter i qs)
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
    // ✅ join for source insight
    .select("id,asset_id,user_id,name,email,phone,message,ts,user_qr_assets(product_type,token)")
    .eq("user_id", userId)
    .gte("ts", fromDate)
    .order("ts", { ascending: false })
    .limit(limit + 1);

  if (cursor) q = q.lt("ts", cursor);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: "LEADS_FETCH_FAILED", details: error.message }, { status: 500 });
  }

  const rows = (data || []) as LeadRowJoined[];
  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  const next_cursor = hasMore && sliced.length ? (sliced[sliced.length - 1].ts || null) : null;

  // ✅ enrich items so UI gets source/token without caring about join shape
  const items = sliced.map((r) => ({
    id: r.id,
    asset_id: r.asset_id,
    user_id: r.user_id,
    name: r.name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    message: r.message ?? null,
    ts: r.ts ?? null,

    // NEW insight fields
    source: (r.user_qr_assets?.product_type ?? null) as ProductType | null,

    // optional debug (keep it; UI can ignore)
    token: (r.user_qr_assets?.token ?? null) as string | null,
  }));

  // ✅ Top sources (counts within current response window: last X days)
  const counts: Record<ProductType, number> = { hoodie: 0, sticker: 0, phonecase: 0 };
  for (const it of items) {
    const s = it.source as ProductType | null;
    if (s && counts[s] != null) counts[s] += 1;
  }

  const top_sources = (Object.entries(counts) as Array<[ProductType, number]>)
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
 * ✅ POST /api/etsy/qr/lead  (public capture)
 * - Kräver INTE session (QR-scan från vem som helst)
 * - user_id sätts från asset.user_id (ägaren av token) => Leads Hub ska filtrera på user_id
 */
export async function POST(req: Request) {
  const supabase = getAdminSupabase();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const token = cleanStr(body?.token, 64);
  const name = cleanStr(body?.name, 120);
  const email = normalizeEmail(body?.email);
  const phone = cleanStr(body?.phone, 60);
  const message = cleanStr(body?.message, 500);

  if (!token) {
    return NextResponse.json({ ok: false, error: "MISSING_TOKEN" }, { status: 400 });
  }

  // Require at least one contact method
  if (!email && !phone) {
    return NextResponse.json(
      { ok: false, error: "MISSING_CONTACT", details: "email or phone is required" },
      { status: 400 }
    );
  }

  // 1) Lookup asset by token
  const { data: asset, error: assetErr } = await supabase
    .from("user_qr_assets")
    .select("id,user_id,token,destination_mode,destination_url,product_type")
    .eq("token", token)
    .maybeSingle();

  if (assetErr) {
    return NextResponse.json(
      { ok: false, error: "ASSET_LOOKUP_FAILED", details: assetErr.message },
      { status: 500 }
    );
  }

  if (!asset) {
    return NextResponse.json({ ok: false, error: "TOKEN_NOT_FOUND", token }, { status: 404 });
  }

  const continue_url = `/go/${encodeURIComponent(token)}?to=affiliate&skip_log=1`;

  // 2) Try insert lead first (fast path)
  const leadPayload = {
    asset_id: asset.id,
    user_id: asset.user_id, // ✅ what Leads Hub should filter by
    name,
    email,
    phone,
    message,
  };

  const { error: leadErr } = await supabase.from("qr_leads").insert(leadPayload);

  if (!leadErr) {
    return NextResponse.json({
      ok: true,
      merged: false,
      destination_mode: asset.destination_mode,
      continue_url,
    });
  }

  // 3) If duplicate (unique violation), smart merge
  const pgCode = (leadErr as any)?.code;
  if (pgCode !== "23505") {
    return NextResponse.json({ ok: false, error: "LEAD_INSERT_FAILED", details: leadErr.message }, { status: 500 });
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("qr_leads")
    .select("id,asset_id,user_id,name,email,phone,message,ts")
    .eq("asset_id", asset.id)
    .order("ts", { ascending: false })
    .limit(50);

  if (rowsErr) {
    return NextResponse.json(
      { ok: true, merged: false, duplicate: true, destination_mode: asset.destination_mode, continue_url },
      { status: 200 }
    );
  }

  const list = (rows || []) as Array<{
    id: number;
    asset_id: string;
    user_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    ts?: string | null;
  }>;

  const emailNorm = email ? email.toLowerCase() : null;
  const phoneNorm = phone ? phone : null;

  const matchByEmail = emailNorm ? list.find((r) => (r.email || "").toLowerCase() === emailNorm) : null;
  const matchByPhone = phoneNorm ? list.find((r) => (r.phone || "") === phoneNorm) : null;

  const target = matchByEmail || matchByPhone;

  if (!target) {
    return NextResponse.json(
      { ok: true, merged: false, duplicate: true, destination_mode: asset.destination_mode, continue_url },
      { status: 200 }
    );
  }

  const nextName = target.name || name || null;
  const nextEmail = target.email ? target.email.toLowerCase() : (emailNorm || null);
  const nextPhone = target.phone || phoneNorm || null;
  const nextMessage = mergeMessage(target.message, message);

  const hasChange =
    nextName !== (target.name || null) ||
    nextEmail !== ((target.email || null)?.toLowerCase() || null) ||
    nextPhone !== (target.phone || null) ||
    nextMessage !== (target.message || null);

  if (!hasChange) {
    return NextResponse.json(
      { ok: true, merged: false, duplicate: true, lead_id: target.id, destination_mode: asset.destination_mode, continue_url },
      { status: 200 }
    );
  }

  const { error: updErr } = await supabase
    .from("qr_leads")
    .update({ name: nextName, email: nextEmail, phone: nextPhone, message: nextMessage })
    .eq("id", target.id);

  if (updErr) {
    return NextResponse.json(
      { ok: true, merged: false, duplicate: true, lead_id: target.id, destination_mode: asset.destination_mode, continue_url },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { ok: true, merged: true, lead_id: target.id, destination_mode: asset.destination_mode, continue_url },
    { status: 200 }
  );
}