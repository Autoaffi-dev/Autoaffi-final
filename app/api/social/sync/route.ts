// app/api/social/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptToken } from "@/lib/socialCrypto";

async function graph<T>(path: string, accessToken: string) {
  const url =
    `https://graph.facebook.com/v20.0/${path}` +
    `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "graph_error");
  return json as T;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const platform = (body?.platform || "instagram").toLowerCase();

  if (platform !== "instagram") {
    return NextResponse.json({ error: "only_instagram_supported" }, { status: 400 });
  }

  // 1) skapa sync-run (säkert)
  const runInsert = await supabaseAdmin
    .from("social_sync_runs")
    .insert({
      user_id: userId,
      platform: "instagram",
      status: "running",
      message: "Sync started",
    })
    .select()
    .single();

  const runId = runInsert.data?.id;

  if (runInsert.error || !runId) {
    return NextResponse.json(
      { ok: false, error: runInsert.error?.message || "sync_run_create_failed" },
      { status: 500 }
    );
  }

  try {
    // 2) hämta connected instagram meta-account
    const { data: acc, error: accErr } = await supabaseAdmin
      .from("user_social_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .eq("provider", "meta")
      .eq("status", "connected")
      .maybeSingle();

    if (accErr) throw new Error(accErr.message);
    if (!acc?.access_token_enc) throw new Error("no_connected_instagram_account");

    const accessToken = decryptToken(acc.access_token_enc);

    // 3) pages
    const pages = await graph<{ data: Array<{ id: string; name: string }> }>(
      "me/accounts?fields=id,name",
      accessToken
    );
    if (!pages?.data?.length) throw new Error("no_pages_found_for_user");

    let igId: string | null = null;
    let pageId: string | null = null;

    for (const p of pages.data) {
      const page = await graph<{ instagram_business_account?: { id: string } }>(
        `${p.id}?fields=instagram_business_account`,
        accessToken
      );
      if (page?.instagram_business_account?.id) {
        igId = page.instagram_business_account.id;
        pageId = p.id;
        break;
      }
    }
    if (!igId) throw new Error("no_instagram_business_account_linked");

    // 4) spara igId på account
    await supabaseAdmin
      .from("user_social_accounts")
      .update({
        account_id: igId,
        meta: { ...(acc.meta || {}), page_id: pageId },
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id);

    // 5) media
    const media = await graph<{
      data: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        permalink?: string;
        timestamp?: string;
        like_count?: number;
        comments_count?: number;
      }>;
    }>(
      `${igId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=25`,
      accessToken
    );

    for (const m of media.data || []) {
      await supabaseAdmin.from("social_posts").upsert(
        {
          user_id: userId,
          platform: "instagram",
          account_id: igId,
          post_id: m.id,
          permalink: m.permalink || null,
          caption: m.caption || null,
          media_type: m.media_type || null,
          posted_at: m.timestamp ? new Date(m.timestamp).toISOString() : null,
        },
        { onConflict: "platform,post_id" }
      );

      let views: number | null = null;
      let plays: number | null = null;
      let reach: number | null = null;
      let impressions: number | null = null;

      try {
        const ins = await graph<{
          data: Array<{ name: string; values: Array<{ value: number }> }>;
        }>(`${m.id}/insights?metric=plays,reach,impressions,video_views`, accessToken);

        for (const row of ins.data || []) {
          const val = row?.values?.[0]?.value;
          if (row.name === "plays") plays = val ?? null;
          if (row.name === "video_views") views = val ?? null;
          if (row.name === "reach") reach = val ?? null;
          if (row.name === "impressions") impressions = val ?? null;
        }
      } catch {}

      // IMPORTANT: upsert istället för insert → ingen dubbelsparning vid sync
      await supabaseAdmin.from("social_post_metrics").upsert(
        {
          user_id: userId,
          platform: "instagram",
          post_id: m.id,
          likes: typeof m.like_count === "number" ? m.like_count : null,
          comments: typeof m.comments_count === "number" ? m.comments_count : null,
          views,
          plays,
          reach,
          impressions,
          captured_at: new Date().toISOString(),
        },
        { onConflict: "platform,post_id" }
      );
    }

    await supabaseAdmin
      .from("social_sync_runs")
      .update({ status: "ok", message: "Sync complete", finished_at: new Date().toISOString() })
      .eq("id", runId);

    return NextResponse.json({ ok: true, synced: (media.data || []).length });
  } catch (e: any) {
    await supabaseAdmin
      .from("social_sync_runs")
      .update({
        status: "error",
        message: e?.message || "Sync failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return NextResponse.json({ ok: false, error: e?.message || "sync_failed" }, { status: 500 });
  }
}