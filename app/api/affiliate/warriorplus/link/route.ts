import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { requireUserId } from "@/lib/auth/server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function sha1(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function cleanPart(v: string) {
  // keep safe chars only
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function buildTrackingCode(args: { userId: string; src?: string; offerId: string }) {
  const userShort = cleanPart(args.userId).slice(0, 12) || "u";
  const src = cleanPart(args.src || "unknown").slice(0, 16) || "src";
  const offer = cleanPart(args.offerId).slice(0, 24) || "offer";

  const raw = `aa_u_${userShort}__src_${src}__p_${offer}`;

  // BEAST: keep length safe. If too long, hash.
  if (raw.length <= 60) return raw;

  const h = sha1(raw).slice(0, 24);
  return `aa_${h}`;
}

function joinTracking(baseUrl: string, trackingCode: string) {
  const b = String(baseUrl || "").trim();
  if (!b) return "";
  const base = b.endsWith("/") ? b.slice(0, -1) : b;
  const t = trackingCode.startsWith("/") ? trackingCode.slice(1) : trackingCode;
  return `${base}/${t}`;
}

function unauthorizedOrError(err: any, logLabel: string) {
  console.error(logLabel, err);
  const msg = err?.message ?? "Failed to generate affiliate link";
  if (msg === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}

async function buildWarriorPlusAffiliateLink(args: {
  userId: string;
  offerId?: string;
  external_id?: string;
  src?: string;
}) {
  const id = String(args.offerId || args.external_id || "").trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing offerId/external_id" }, { status: 400 });
  }

  const src = String(args.src || "").trim();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("product_index")
    .select("source,external_id,product_url,landing_url,is_active,is_approved,title")
    .eq("source", "warriorplus")
    .eq("external_id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return NextResponse.json({ success: false, error: "Offer not found in product_index" }, { status: 404 });
  }

  if (data.is_active === false) {
    return NextResponse.json({ success: false, error: "Offer is not active" }, { status: 400 });
  }
  if (data.is_approved === false) {
    return NextResponse.json({ success: false, error: "Offer is not approved" }, { status: 400 });
  }

  const base = String(data.product_url || data.landing_url || "").trim();
  if (!base) {
    return NextResponse.json({ success: false, error: "Offer missing product_url" }, { status: 400 });
  }

  const tracking_code = buildTrackingCode({
    userId: args.userId,
    src,
    offerId: String(data.external_id),
  });
  const affiliate_url = joinTracking(base, tracking_code);

  return NextResponse.json({
    success: true,
    source: "warriorplus",
    external_id: data.external_id,
    title: data.title ?? null,
    base_url: base,
    tracking_code,
    affiliate_url,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const offerId = (searchParams.get("offerId") ?? "").trim();
    const external_id = (searchParams.get("external_id") ?? "").trim();
    const src = (searchParams.get("src") ?? "").trim();

    if (!(offerId || external_id)) {
      return NextResponse.json({ success: false, error: "Missing offerId/external_id" }, { status: 400 });
    }

    const userId = await requireUserId(req);
    return await buildWarriorPlusAffiliateLink({ userId, offerId, external_id, src });
  } catch (err: any) {
    return unauthorizedOrError(err, "[affiliate/warriorplus/link] error:");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = (await req.json().catch(() => ({}))) as any;
    void body?.userId;

    const offerId = String(body?.offerId ?? "").trim();
    const external_id = String(body?.external_id ?? "").trim();
    const src = String(body?.src ?? "").trim();

    return await buildWarriorPlusAffiliateLink({ userId, offerId, external_id, src });
  } catch (err: any) {
    return unauthorizedOrError(err, "[affiliate/warriorplus/link][POST] error:");
  }
}