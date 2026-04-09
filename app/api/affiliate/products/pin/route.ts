import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
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
    const pinned = body?.pinned !== false; // default true

    if (!savedId) {
      return jsonNoStore(
        { ok: false, error: "savedId required" },
        { status: 400 }
      );
    }

    const verifyRes = await supabaseAdmin
      .from("user_offers")
      .select("id,user_id,is_pinned,pin_rank,title,source,external_id")
      .eq("id", savedId)
      .eq("user_id", userId)
      .maybeSingle();

    if (verifyRes.error) {
      return jsonNoStore(
        { ok: false, error: verifyRes.error.message || "Verify failed" },
        { status: 500 }
      );
    }

    if (!verifyRes.data) {
      return jsonNoStore(
        { ok: false, error: "Offer not found" },
        { status: 404 }
      );
    }

    let nextPinRank: number | null = null;

    if (pinned) {
      const rankRes = await supabaseAdmin
        .from("user_offers")
        .select("pin_rank")
        .eq("user_id", userId)
        .eq("is_pinned", true)
        .order("pin_rank", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rankRes.error) {
        return jsonNoStore(
          { ok: false, error: rankRes.error.message || "Pin rank lookup failed" },
          { status: 500 }
        );
      }

      nextPinRank = ((rankRes.data?.pin_rank as number | null) ?? 0) + 1;
    }

    const updateRes = await supabaseAdmin
      .from("user_offers")
      .update({
        is_pinned: pinned,
        pin_rank: pinned ? nextPinRank : null,
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
          "is_pinned",
          "pin_rank",
          "is_primary",
          "affiliate_link",
          "subid",
          "updated_at",
        ].join(",")
      )
      .maybeSingle();

    if (updateRes.error) {
      return jsonNoStore(
        { ok: false, error: updateRes.error.message || "Pin update failed" },
        { status: 500 }
      );
    }

    return jsonNoStore({
      ok: true,
      item: updateRes.data || null,
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/pin] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "pin failed" },
      { status: 500 }
    );
  }
}