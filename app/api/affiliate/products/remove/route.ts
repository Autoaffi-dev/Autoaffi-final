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

    if (!savedId) {
      return jsonNoStore(
        { ok: false, error: "savedId required" },
        { status: 400 }
      );
    }

    const verifyRes = await supabaseAdmin
      .from("user_offers")
      .select("id,user_id,title,source,external_id,is_primary,is_pinned")
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

    const deleteRes = await supabaseAdmin
      .from("user_offers")
      .delete()
      .eq("id", savedId)
      .eq("user_id", userId);

    if (deleteRes.error) {
      return jsonNoStore(
        { ok: false, error: deleteRes.error.message || "Remove failed" },
        { status: 500 }
      );
    }

    return jsonNoStore({
      ok: true,
      removed: {
        id: verifyRes.data.id,
        source: verifyRes.data.source,
        external_id: verifyRes.data.external_id,
        title: verifyRes.data.title,
      },
      wasPrimary: !!verifyRes.data.is_primary,
      wasPinned: !!verifyRes.data.is_pinned,
    });
  } catch (e: any) {
    console.error("[api/affiliate/products/remove] error:", e);
    return jsonNoStore(
      { ok: false, error: e?.message ?? "remove failed" },
      { status: 500 }
    );
  }
}