import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function pickUserId(req: Request, body: any) {
  return (
    req.headers.get("x-autoaffi-user-id") ||
    body?.user_id ||
    body?.userId ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const userId = pickUserId(req, body);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing user_id (send in body.user_id eller header x-autoaffi-user-id)" },
        { status: 400 }
      );
    }

    // ⚠️ Om din tabell heter något annat, byt bara denna sträng.
    const TABLE = "user_affiliate_ids";

    const payload = {
      user_id: userId,

      digistore_id: body?.digistore_id ?? body?.digistoreId ?? null,
      mylead_id: body?.mylead_id ?? body?.myleadId ?? null,
      cpalead_id: body?.cpalead_id ?? body?.cpaleadId ?? null,
      amazon_tag: body?.amazon_tag ?? body?.amazonTag ?? body?.amazonTrackingId ?? null,
      impact_id: body?.impact_id ?? body?.impactId ?? null,

      custom_network_name: body?.custom_network_name ?? body?.customNetworkName ?? null,
      custom_network_id: body?.custom_network_id ?? body?.customNetworkId ?? null,

      updated_at: new Date().toISOString(),
    };

    // 1) Försök UPSET (snabbast)
    const upsertRes = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (!upsertRes.error) {
      return NextResponse.json({ ok: true, data: upsertRes.data });
    }

    // 2) Om DB saknar unique constraint på user_id -> fallback select->update/insert
    const msg = upsertRes.error.message || "";
    const needsFallback =
      msg.includes("no unique") ||
      msg.includes("there is no unique") ||
      msg.includes("ON CONFLICT") ||
      msg.includes("constraint");

    if (!needsFallback) {
      return NextResponse.json({ ok: false, error: upsertRes.error }, { status: 500 });
    }

    const existing = await supabase.from(TABLE).select("user_id").eq("user_id", userId).maybeSingle();

    if (existing.data) {
      const updated = await supabase.from(TABLE).update(payload).eq("user_id", userId).select().single();
      if (updated.error) {
        return NextResponse.json({ ok: false, error: updated.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: updated.data, fallback: "update" });
    } else {
      const inserted = await supabase.from(TABLE).insert(payload).select().single();
      if (inserted.error) {
        return NextResponse.json({ ok: false, error: inserted.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: inserted.data, fallback: "insert" });
    }
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}