import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptToken } from "@/lib/socialCrypto";
import { getValidAccessToken } from "@/lib/socialTokens";

export const runtime = "nodejs";

type Platform = "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "x";

function normalizePlatform(v: any): Platform {
  const p = String(v || "instagram").toLowerCase().trim();
  if (p === "instagram" || p === "facebook" || p === "tiktok" || p === "youtube" || p === "linkedin" || p === "x") {
    return p;
  }
  return "instagram";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function withTimeout(ms = 20_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

// -------------------- Runs --------------------

async function createRun(userId: string, platform: Platform) {
  const runInsert = await supabaseAdmin
    .from("social_sync_runs")
    .insert({ user_id: userId, platform, status: "running", message: "Sync started" })
    .select()
    .single();

  const runId = runInsert.data?.id;
  if (runInsert.error || !runId) throw new Error(runInsert.error?.message || "sync_run_create_failed");
  return String(runId);
}

async function finishRunOk(runId: string, message: string, meta?: any) {
  await supabaseAdmin
    .from("social_sync_runs")
    .update({ status: "ok", message, meta: meta ?? null, finished_at: new Date().toISOString() })
    .eq("id", runId);
}

async function finishRunError(runId: string, message: string, meta?: any) {
  await supabaseAdmin
    .from("social_sync_runs")
    .update({ status: "error", message, meta: meta ?? null, finished_at: new Date().toISOString() })
    .eq("id", runId);
}

// -------------------- Helpers --------------------

async function getConnectedAccount(userId: string, platform: Platform) {
  const { data, error } = await supabaseAdmin
    .from("user_social_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("status", "connected")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as any | null;
}

async function markAccountSynced(userId: string, platform: Platform, patchMeta: any = {}) {
  const now = new Date().toISOString();

  const { data: cur, error: curErr } = await supabaseAdmin
    .from("user_social_accounts")
    .select("id, meta")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (curErr) throw new Error("account_read_failed: " + curErr.message);

  const nextMeta = { ...(cur?.meta || {}), ...(patchMeta || {}) };

  const { error } = await supabaseAdmin
    .from("user_social_accounts")
    .update({ updated_at: now, meta: nextMeta })
    .eq("user_id", userId)
    .eq("platform", platform);

  if (error) throw new Error("account_update_failed: " + error.message);
}

/**
 * ✅ SKARP STUB: ingen fake-data.
 */
async function stubSync(userId: string, platform: Platform, runId: string) {
  await markAccountSynced(userId, platform, {
    last_sync: {
      platform,
      mode: "stub",
      at: new Date().toISOString(),
      note: "Stub sync: ready for API later (no fake metrics).",
    },
  });

  await finishRunOk(runId, "Stub sync complete", { platform, mode: "stub" });

  return NextResponse.json({
    ok: true,
    platform,
    mode: "stub",
    synced: 0,
    note: "Stub sync: updates lastSynced + logs run. Replace with full API sync after approvals/scopes.",
  });
}

// -------------------- Meta Graph (IG/FB) --------------------

async function graph<T>(path: string, accessToken: string) {
  const url =
    `https://graph.facebook.com/v20.0/${path}` +
    `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;

  const { signal, done } = withTimeout(20_000);
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || "graph_error");
    return json as T;
  } finally {
    done();
  }
}

// -------------------- YouTube API --------------------

async function yt<T>(url: string, accessToken: string) {
  const { signal, done } = withTimeout(20_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || "youtube_api_error";
      throw new Error(msg);
    }
    return json as T;
  } finally {
    done();
  }
}

// -------------------- Sync Implementations --------------------

async function syncInstagram(userId: string, runId: string) {
  const acc = await getConnectedAccount(userId, "instagram");
  if (!acc) throw new Error("no_connected_instagram_account_row");
  if (acc.provider !== "meta") throw new Error("instagram_provider_must_be_meta");
  if (!acc.access_token_enc) throw new Error("no_connected_instagram_access_token");

  // ✅ Just nu: Meta refresh/exchange är inte implementerat i socialTokens.ts (din lib är google-only).
  // Därför: decrypt direkt för stabil drift tills du lägger Meta exchange/long-lived.
  const accessToken = decryptToken(acc.access_token_enc);

  const pages = await graph<{ data: Array<{ id: string; name: string }> }>("me/accounts?fields=id,name", accessToken);
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

  await supabaseAdmin
    .from("user_social_accounts")
    .update({
      account_id: igId,
      meta: { ...(acc.meta || {}), page_id: pageId },
      updated_at: new Date().toISOString(),
    })
    .eq("id", acc.id);

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
  }>(`${igId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=25`, accessToken);

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
    } catch {
      // insights kan faila för vissa media types / permissions
    }

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

  await finishRunOk(runId, "Instagram sync complete", {
    platform: "instagram",
    mode: "full",
    synced: (media.data || []).length,
  });

  await markAccountSynced(userId, "instagram", {
    page_id: pageId,
    last_sync: {
      platform: "instagram",
      mode: "full",
      at: new Date().toISOString(),
      items: (media.data || []).length,
    },
  });

  return NextResponse.json({ ok: true, platform: "instagram", mode: "full", synced: (media.data || []).length });
}

async function syncYouTube(userId: string, runId: string) {
  const acc = await getConnectedAccount(userId, "youtube");
  if (!acc) throw new Error("no_connected_youtube_account_row");
  if (acc.provider !== "google") throw new Error("youtube_provider_must_be_google");
  if (!acc.access_token_enc) throw new Error("no_connected_youtube_access_token");

  // ✅ PRODUCTION-STABIL: auto-refresh via lib/socialTokens.ts (google refresh_token)
  const tokenRes = await getValidAccessToken({
    userId,
    platform: "youtube",
    provider: "google",
    skewSec: 10 * 60,
  });

  const accessToken = tokenRes.accessToken;

  const ch = await yt<{
    items?: Array<{
      id: string;
      snippet?: { title?: string };
      statistics?: { viewCount?: string; subscriberCount?: string; videoCount?: string };
    }>;
  }>("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", accessToken);

  const channel = ch?.items?.[0];
  if (!channel?.id) throw new Error("youtube_no_channel_found");

  const channelId = channel.id;
  const channelTitle = channel.snippet?.title || "YouTube channel";

  const search = await yt<{
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string; description?: string } }>;
  }>("https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=25&order=date", accessToken);

  const videoIds = (search?.items || []).map((i) => i?.id?.videoId).filter(Boolean) as string[];

  let videos: Array<any> = [];
  if (videoIds.length > 0) {
    const idsParam = encodeURIComponent(videoIds.join(","));
    const vids = await yt<{
      items?: Array<{
        id: string;
        snippet?: { title?: string; description?: string; publishedAt?: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    }>(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${idsParam}`, accessToken);

    videos = vids?.items || [];
  }

  await supabaseAdmin
    .from("user_social_accounts")
    .update({
      account_id: channelId,
      username: channelTitle,
      updated_at: new Date().toISOString(),
      meta: {
        ...(acc.meta || {}),
        channel: { id: channelId, title: channelTitle, stats: channel.statistics || null },
      },
    })
    .eq("id", acc.id);

  for (const v of videos) {
    const vid = String(v.id);
    const title = v.snippet?.title || null;
    const desc = v.snippet?.description || null;
    const postedAt = v.snippet?.publishedAt ? new Date(v.snippet.publishedAt).toISOString() : null;
    const permalink = `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`;

    await supabaseAdmin.from("social_posts").upsert(
      {
        user_id: userId,
        platform: "youtube",
        account_id: channelId,
        post_id: vid,
        permalink,
        caption: title ? (desc ? `${title}\n\n${desc}` : title) : desc,
        media_type: "video",
        posted_at: postedAt,
      },
      { onConflict: "platform,post_id" }
    );

    const views = v.statistics?.viewCount ? Number(v.statistics.viewCount) : null;
    const likes = v.statistics?.likeCount ? Number(v.statistics.likeCount) : null;
    const comments = v.statistics?.commentCount ? Number(v.statistics.commentCount) : null;

    await supabaseAdmin.from("social_post_metrics").upsert(
      {
        user_id: userId,
        platform: "youtube",
        post_id: vid,
        likes: Number.isFinite(likes as any) ? likes : null,
        comments: Number.isFinite(comments as any) ? comments : null,
        views: Number.isFinite(views as any) ? views : null,
        plays: null,
        reach: null,
        impressions: null,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "platform,post_id" }
    );
  }

  await finishRunOk(runId, "YouTube sync complete", {
    platform: "youtube",
    mode: "full",
    synced: videos.length,
    tokenRefreshed: tokenRes.refreshed,
    tokenExpiresAt: tokenRes.expiresAt,
  });

  await markAccountSynced(userId, "youtube", {
    last_sync: { platform: "youtube", mode: "full", at: new Date().toISOString(), items: videos.length },
    channel: { id: channelId, title: channelTitle },
    token: { refreshed: tokenRes.refreshed, expiresAt: tokenRes.expiresAt },
  });

  return NextResponse.json({ ok: true, platform: "youtube", mode: "full", synced: videos.length });
}

// -------------------- Main Route --------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userIdRaw = (session as any)?.user?.id;

  if (!userIdRaw) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = String(userIdRaw);
  if (!isUuid(userId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_user_id_not_uuid",
        received: userId,
        hint: "Fix NextAuth callbacks: session.user.id måste vara Supabase user UUID.",
      },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const platform = normalizePlatform(body?.platform);

  let runId: string;
  try {
    runId = await createRun(userId, platform);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "sync_run_create_failed" }, { status: 500 });
  }

  try {
    if (platform === "instagram") return await syncInstagram(userId, runId);
    if (platform === "youtube") return await syncYouTube(userId, runId);

    const acc = await getConnectedAccount(userId, platform);
    if (!acc) {
      await finishRunError(runId, `no_connected_${platform}_account_row`, { platform, mode: "stub" });
      return NextResponse.json({ ok: false, platform, mode: "stub", error: `no_connected_${platform}_account_row` }, { status: 400 });
    }

    return await stubSync(userId, platform, runId);
  } catch (e: any) {
    const msg = e?.message || "sync_failed";
    await finishRunError(runId, msg, { platform });
    return NextResponse.json({ ok: false, platform, error: msg }, { status: 500 });
  }
}