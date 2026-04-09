import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: true, offer: null }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_offers")
      .select(
        [
          "id",
          "user_id",
          "source",
          "external_id",
          "title",
          "description",
          "category",
          "niche",
          "merchant_name",
          "merchant_id",
          "product_url",
          "image_url",
          "affiliate_link",
          "subid",
          "is_primary",
          "is_pinned",
          "pin_rank",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (error) {
      console.error("[offers/primary][GET] error:", error);
      return jsonNoStore({ ok: true, offer: null }, { status: 200 });
    }

    return jsonNoStore({ ok: true, offer: data || null }, { status: 200 });
  } catch (err: any) {
    console.error("[offers/primary][GET] crash:", err);
    return jsonNoStore({ ok: true, offer: null }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const savedId = String(body?.savedId || "").trim();

    if (!savedId) {
      return jsonNoStore(
        { ok: false, error: "savedId required" },
        { status: 400 }
      );
    }

    // 1) verify that the offer belongs to this user
    const existing = await supabaseAdmin
      .from("user_offers")
      .select("id,user_id,title,source,external_id")
      .eq("id", savedId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.error) {
      console.error("[offers/primary][verify] error:", existing.error);
      return jsonNoStore(
        { ok: false, error: existing.error.message || "Failed to verify offer" },
        { status: 500 }
      );
    }

    if (!existing.data) {
      return jsonNoStore(
        { ok: false, error: "Offer not found" },
        { status: 404 }
      );
    }

    // 2) unset any current primary for this user
    const unsetRes = await supabaseAdmin
      .from("user_offers")
      .update({
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_primary", true);

    if (unsetRes.error) {
      console.error("[offers/primary][unset] error:", unsetRes.error);
      return jsonNoStore(
        { ok: false, error: unsetRes.error.message || "Failed to unset previous primary" },
        { status: 500 }
      );
    }

    // 3) set selected offer as primary
    const setRes = await supabaseAdmin
      .from("user_offers")
      .update({
        is_primary: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedId)
      .eq("user_id", userId)
      .select(
        [
          "id",
          "user_id",
          "source",
          "external_id",
          "title",
          "description",
          "category",
          "niche",
          "merchant_name",
          "merchant_id",
          "product_url",
          "image_url",
          "affiliate_link",
          "subid",
          "is_primary",
          "is_pinned",
          "pin_rank",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .maybeSingle();

    if (setRes.error) {
      console.error("[offers/primary][set] error:", setRes.error);
      return jsonNoStore(
        { ok: false, error: setRes.error.message || "Failed to set primary" },
        { status: 500 }
      );
    }

    return jsonNoStore(
      { ok: true, offer: setRes.data || null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[offers/primary][POST] crash:", err);
    return jsonNoStore(
      { ok: false, error: err?.message || "Failed to set primary" },
      { status: 500 }
    );
  }
}