// app/api/social/sync/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getValidAccessToken,
  type SocialProvider,
} from "@/lib/socialTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "threads"
  | "linkedin"
  | "x";

type JsonObject = Record<string, unknown>;

type ConnectedAccountRow = {
  id: string;
  user_id: string;
  platform: Platform;
  provider: SocialProvider;
  status: string;
  account_id: string | null;
  username: string | null;
  token_expires_at: string | null;
  meta: JsonObject | null;
};

type MetaApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type MetaPaging = {
  cursors?: {
    before?: string;
    after?: string;
  };
  next?: string;
  previous?: string;
};

type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  category?: string;
  instagram_business_account?: {
    id?: string;
  };
};

type MetaPagesResponse =
  MetaApiError & {
    data?: MetaPage[];
    paging?: MetaPaging;
  };

type MetaPageInstagramResponse =
  MetaApiError & {
    id?: string;
    name?: string;
    instagram_business_account?: {
      id?: string;
    };
  };

type InstagramProfile =
  MetaApiError & {
    id?: string;
    user_id?: string;
    username?: string;
    name?: string;
    account_type?: string;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  };

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramMediaResponse =
  MetaApiError & {
    data?: InstagramMedia[];
    paging?: MetaPaging;
  };

type InstagramInsightValue = {
  value?: number | JsonObject;
  end_time?: string;
};

type InstagramInsight = {
  id?: string;
  name?: string;
  period?: string;
  title?: string;
  description?: string;
  values?: InstagramInsightValue[];
  total_value?: {
    value?: number | JsonObject;
  };
};

type InstagramInsightsResponse =
  MetaApiError & {
    data?: InstagramInsight[];
  };

type FacebookPost = {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: {
    count?: number;
  };
  reactions?: {
    summary?: {
      total_count?: number;
    };
  };
  comments?: {
    summary?: {
      total_count?: number;
    };
  };
};

type FacebookPostsResponse =
  MetaApiError & {
    data?: FacebookPost[];
    paging?: MetaPaging;
  };

type FacebookInsight = {
  id?: string;
  name?: string;
  period?: string;
  values?: Array<{
    value?: number | JsonObject;
    end_time?: string;
  }>;
};

type FacebookInsightsResponse =
  MetaApiError & {
    data?: FacebookInsight[];
  };

// -------------------- Threads types --------------------

type ThreadsApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type ThreadsProfile =
  ThreadsApiError & {
    id?: string;
    username?: string;
    name?: string;
    threads_profile_picture_url?: string;
    threads_biography?: string;
    is_verified?: boolean;
  };

type ThreadsPost = {
  id: string;
  media_product_type?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  username?: string;
  text?: string;
  timestamp?: string;
  shortcode?: string;
  thumbnail_url?: string;
  is_quote_post?: boolean;
  alt_text?: string;
};

type ThreadsPostsResponse =
  ThreadsApiError & {
    data?: ThreadsPost[];
    paging?: MetaPaging;
  };

type ThreadsInsight = {
  id?: string;
  name?: string;
  period?: string;
  title?: string;
  description?: string;
  values?: Array<{
    value?: number | JsonObject;
    end_time?: string;
  }>;
  total_value?: {
    value?: number | JsonObject;
  };
};

type ThreadsInsightsResponse =
  ThreadsApiError & {
    data?: ThreadsInsight[];
  };

type ThreadsMediaMetrics = {
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
};

// -------------------- YouTube types --------------------

type YouTubeChannelResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: {
        default?: {
          url?: string;
        };
        medium?: {
          url?: string;
        };
        high?: {
          url?: string;
        };
      };
    };
    statistics?: {
      viewCount?: string;
      subscriberCount?: string;
      hiddenSubscriberCount?: boolean;
      videoCount?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type YouTubeVideosResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      liveBroadcastContent?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
      favoriteCount?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

// -------------------- TikTok types --------------------

type TikTokApiError = {
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

type TikTokUser = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  avatar_url_100?: string;
  avatar_large_url?: string;
  display_name?: string;
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  username?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
};

type TikTokUserResponse =
  TikTokApiError & {
    data?: {
      user?: TikTokUser;
    };
  };

type TikTokVideo = {
  id: string;
  title?: string;
  video_description?: string;
  duration?: number;
  cover_image_url?: string;
  embed_link?: string;
  share_url?: string;
  create_time?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
};

type TikTokVideoListResponse =
  TikTokApiError & {
    data?: {
      videos?: TikTokVideo[];
      cursor?: number;
      has_more?: boolean;
    };
  };

// -------------------- LinkedIn types --------------------

type LinkedInUserInfo = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?:
    | string
    | {
        country?: string;
        language?: string;
      };
  email?: string;
  email_verified?: boolean;
};

// -------------------- X types --------------------

type XApiError = {
  errors?: Array<{
    title?: string;
    detail?: string;
    type?: string;
    status?: number;
  }>;
};

type XUser = {
  id: string;
  name?: string;
  username?: string;
  created_at?: string;
  description?: string;
  location?: string;
  profile_image_url?: string;
  protected?: boolean;
  url?: string;
  verified?: boolean;
  verified_type?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
    like_count?: number;
    media_count?: number;
  };
};

type XUserResponse =
  XApiError & {
    data?: XUser;
  };

type XPost = {
  id: string;
  text?: string;
  created_at?: string;
  lang?: string;
  conversation_id?: string;
  possibly_sensitive?: boolean;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
};

type XPostsResponse =
  XApiError & {
    data?: XPost[];
    meta?: {
      result_count?: number;
      newest_id?: string;
      oldest_id?: string;
      next_token?: string;
    };
  };

// -------------------------------------------------------
// General helpers
// -------------------------------------------------------

function normalizePlatform(
  value: unknown
): Platform {
  const platform =
    String(value ?? "")
      .toLowerCase()
      .trim();

  if (
    platform === "instagram" ||
    platform === "facebook" ||
    platform === "tiktok" ||
    platform === "youtube" ||
    platform === "threads" ||
    platform === "linkedin" ||
    platform === "x"
  ) {
    return platform;
  }

  throw new Error(
    `invalid_platform:${platform || "missing"}`
  );
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function withTimeout(
  ms = 20_000
): {
  signal: AbortSignal;
  done: () => void;
} {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      ms
    );

  return {
    signal:
      controller.signal,

    done:
      () =>
        clearTimeout(
          timeout
        ),
  };
}

function getMetaGraphVersion(): string {
  const configured =
    process.env
      .META_GRAPH_API_VERSION
      ?.trim() ||
    "v26.0";

  return configured.startsWith(
    "v"
  )
    ? configured
    : `v${configured}`;
}

function getThreadsGraphVersion(): string {
  const configured =
    process.env
      .THREADS_GRAPH_API_VERSION
      ?.trim() ||
    "v1.0";

  return configured.startsWith(
    "v"
  )
    ? configured
    : `v${configured}`;
}

function safeNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      "string" &&
    value.trim() &&
    Number.isFinite(
      Number(value)
    )
  ) {
    return Number(
      value
    );
  }

  return null;
}

function safeIsoDate(
  value: unknown
): string | null {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return null;
  }

  const timestamp =
    Date.parse(
      value
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return new Date(
    timestamp
  ).toISOString();
}

function unixSecondsToIso(
  value: unknown
): string | null {
  const seconds =
    safeNumber(
      value
    );

  if (
    seconds === null ||
    seconds <= 0
  ) {
    return null;
  }

  return new Date(
    seconds * 1000
  ).toISOString();
}

function getObject(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function sumKnownNumbers(
  values: Array<
    number | null
  >
): number | null {
  let found =
    false;

  let total =
    0;

  for (
    const value of
    values
  ) {
    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      found =
        true;

      total +=
        value;
    }
  }

  return found
    ? total
    : null;
}

function publicSyncError(
  message: string
): {
  status: number;
  error: string;
} {
  if (
    message ===
      "no_connected_account" ||
    message.startsWith(
      "no_connected_"
    )
  ) {
    return {
      status: 400,
      error: message,
    };
  }

  if (
    message.includes(
      "missing_refresh_token"
    ) ||
    message.includes(
      "reconnect"
    ) ||
    message.includes(
      "invalid_grant"
    ) ||
    message.includes(
      "invalid_token"
    ) ||
    message.includes(
      "refresh_not_implemented"
    )
  ) {
    return {
      status: 409,
      error:
        "reconnect_required",
    };
  }

  if (
    message.startsWith(
      "wrong_provider"
    ) ||
    message.includes(
      "provider_must_be"
    )
  ) {
    return {
      status: 409,
      error: message,
    };
  }

  if (
    message.includes(
      "permission"
    ) ||
    message.includes(
      "scope"
    ) ||
    message.includes(
      "insufficient"
    )
  ) {
    return {
      status: 403,
      error:
        "platform_permission_missing",
    };
  }

  if (
    message.includes(
      "AbortError"
    ) ||
    message.includes(
      "aborted"
    ) ||
    message.includes(
      "timeout"
    )
  ) {
    return {
      status: 504,
      error:
        "platform_request_timeout",
    };
  }

  return {
    status: 500,
    error:
      message ||
      "sync_failed",
  };
}

// -------------------------------------------------------
// Sync runs
// -------------------------------------------------------

async function createRun(
  userId: string,
  platform: Platform
): Promise<string> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "social_sync_runs"
      )
      .insert({
        user_id:
          userId,

        platform,

        status:
          "running",

        message:
          "Sync started",
      })
      .select(
        "id"
      )
      .single();

  if (
    error ||
    !data?.id
  ) {
    throw new Error(
      error?.message ||
        "sync_run_create_failed"
    );
  }

  return String(
    data.id
  );
}

async function finishRunOk(
  runId: string,
  message: string,
  meta?: JsonObject
): Promise<void> {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "social_sync_runs"
      )
      .update({
        status:
          "ok",

        message,

        meta:
          meta ??
          null,

        finished_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        runId
      );

  if (
    error
  ) {
    console.error(
      "[social-sync] Failed to finish successful run",
      {
        runId,

        error:
          error.message,
      }
    );
  }
}

async function finishRunError(
  runId: string,
  message: string,
  meta?: JsonObject
): Promise<void> {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "social_sync_runs"
      )
      .update({
        status:
          "error",

        message,

        meta:
          meta ??
          null,

        finished_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        runId
      );

  if (
    error
  ) {
    console.error(
      "[social-sync] Failed to finish failed run",
      {
        runId,

        error:
          error.message,
      }
    );
  }
}

// -------------------------------------------------------
// Database helpers
// -------------------------------------------------------

async function getConnectedAccount(
  userId: string,
  platform: Platform
): Promise<ConnectedAccountRow> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .select(
        [
          "id",
          "user_id",
          "platform",
          "provider",
          "status",
          "account_id",
          "username",
          "token_expires_at",
          "meta",
        ].join(",")
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "platform",
        platform
      )
      .eq(
        "status",
        "connected"
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      `account_read_failed:${error.message}`
    );
  }

  if (
    !data
  ) {
    throw new Error(
      `no_connected_${platform}_account_row`
    );
  }

  return data as unknown as ConnectedAccountRow;
}

async function updateConnectedAccount(
  args: {
    rowId: string;
    accountId?:
      | string
      | null;
    username?:
      | string
      | null;
    existingMeta?:
      | JsonObject
      | null;
    metaPatch?: JsonObject;
  }
): Promise<void> {
  const payload:
    Record<
      string,
      unknown
    > = {
    updated_at:
      new Date()
        .toISOString(),

    meta: {
      ...getObject(
        args.existingMeta
      ),

      ...(
        args.metaPatch ??
        {}
      ),
    },
  };

  if (
    args.accountId !==
    undefined
  ) {
    payload.account_id =
      args.accountId;
  }

  if (
    args.username !==
    undefined
  ) {
    payload.username =
      args.username;
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .update(
        payload
      )
      .eq(
        "id",
        args.rowId
      );

  if (
    error
  ) {
    throw new Error(
      `account_update_failed:${error.message}`
    );
  }
}

async function markAccountSynced(
  account: ConnectedAccountRow,
  patchMeta: JsonObject
): Promise<void> {
  await updateConnectedAccount(
    {
      rowId:
        account.id,

      existingMeta:
        account.meta,

      metaPatch:
        patchMeta,
    }
  );
}

async function upsertSocialPost(
  args: {
    userId: string;
    platform: Platform;
    accountId: string;
    postId: string;
    permalink?:
      | string
      | null;
    caption?:
      | string
      | null;
    mediaType?:
      | string
      | null;
    postedAt?:
      | string
      | null;
  }
): Promise<void> {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "social_posts"
      )
      .upsert(
        {
          user_id:
            args.userId,

          platform:
            args.platform,

          account_id:
            args.accountId,

          post_id:
            args.postId,

          permalink:
            args.permalink ??
            null,

          caption:
            args.caption ??
            null,

          media_type:
            args.mediaType ??
            null,

          posted_at:
            args.postedAt ??
            null,
        },
        {
          onConflict:
            "platform,post_id",
        }
      );

  if (
    error
  ) {
    throw new Error(
      `social_post_upsert_failed:${error.message}`
    );
  }
}

async function upsertSocialPostMetrics(
  args: {
    userId: string;
    platform: Platform;
    postId: string;
    likes?:
      | number
      | null;
    comments?:
      | number
      | null;
    views?:
      | number
      | null;
    plays?:
      | number
      | null;
    reach?:
      | number
      | null;
    impressions?:
      | number
      | null;
  }
): Promise<void> {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "social_post_metrics"
      )
      .upsert(
        {
          user_id:
            args.userId,

          platform:
            args.platform,

          post_id:
            args.postId,

          likes:
            args.likes ??
            null,

          comments:
            args.comments ??
            null,

          views:
            args.views ??
            null,

          plays:
            args.plays ??
            null,

          reach:
            args.reach ??
            null,

          impressions:
            args.impressions ??
            null,

          fetched_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "user_id,platform,post_id",
        }
      );

  if (
    error
  ) {
    throw new Error(
      `social_metrics_upsert_failed:${error.message}`
    );
  }
}

// -------------------------------------------------------
// Generic API helper
// -------------------------------------------------------

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20_000
): Promise<T> {
  const {
    signal,
    done,
  } =
    withTimeout(
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...init,

          cache:
            "no-store",

          signal,

          headers: {
            Accept:
              "application/json",

            ...(
              init.headers ??
              {}
            ),
          },
        }
      );

    const body =
      (await response
        .json()
        .catch(
          () => ({})
        )) as T & {
        error?: unknown;
        errors?: unknown;
      };

    if (
      !response.ok
    ) {
      const bodyObject =
        getObject(
          body
        );

      const nestedError =
        getObject(
          bodyObject.error
        );

      const message =
        String(
          nestedError.message ??
            nestedError.error_description ??
            bodyObject.error_description ??
            bodyObject.message ??
            `platform_http_${response.status}`
        ) ||
        `platform_http_${response.status}`;

      throw new Error(
        message
      );
    }

    return body;
  } finally {
    done();
  }
}

// -------------------------------------------------------
// Facebook Meta API
// -------------------------------------------------------

function createMetaUrl(
  path: string,
  accessToken: string
): string {
  const normalizedPath =
    path.replace(
      /^\/+/,
      ""
    );

  const url =
    new URL(
      `https://graph.facebook.com/${getMetaGraphVersion()}/${normalizedPath}`
    );

  url.searchParams.set(
    "access_token",
    accessToken
  );

  return url.toString();
}

async function metaGraph<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const body =
    await fetchJson<
      T &
        MetaApiError
    >(
      createMetaUrl(
        path,
        accessToken
      )
    );

  if (
    body.error?.message
  ) {
    throw new Error(
      `meta_api_error:${body.error.message}`
    );
  }

  return body;
}

/*
 * -------------------------------------------------------
 * Instagram Graph API
 * -------------------------------------------------------
 *
 * Instagram API with Instagram Login använder
 * graph.instagram.com direkt.
 *
 * Instagram-tokenen ska aldrig skickas till
 * graph.facebook.com.
 *
 * Ingen Facebook Page krävs.
 */

function createInstagramGraphUrl(
  path: string,
  accessToken: string
): string {
  const normalizedPath =
    path.replace(
      /^\/+/,
      ""
    );

  const url =
    new URL(
      `https://graph.instagram.com/${getMetaGraphVersion()}/${normalizedPath}`
    );

  url.searchParams.set(
    "access_token",
    accessToken
  );

  return url.toString();
}

async function instagramGraph<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const body =
    await fetchJson<
      T &
        MetaApiError
    >(
      createInstagramGraphUrl(
        path,
        accessToken
      )
    );

  if (
    body.error?.message
  ) {
    throw new Error(
      `instagram_api_error:${body.error.message}`
    );
  }

  return body;
}

/*
 * -------------------------------------------------------
 * Threads Graph API
 * -------------------------------------------------------
 *
 * Threads använder sitt eget Graph API.
 *
 * Threads-tokenen ska aldrig skickas till:
 *
 * graph.facebook.com
 * graph.instagram.com
 *
 * provider är fortfarande "meta" i Autoaffis DB,
 * men platform = "threads".
 */

function createThreadsGraphUrl(
  path: string,
  accessToken: string
): string {
  const normalizedPath =
    path.replace(
      /^\/+/,
      ""
    );

  const url =
    new URL(
      `https://graph.threads.com/${getThreadsGraphVersion()}/${normalizedPath}`
    );

  url.searchParams.set(
    "access_token",
    accessToken
  );

  return url.toString();
}

async function threadsGraph<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const body =
    await fetchJson<
      T &
        ThreadsApiError
    >(
      createThreadsGraphUrl(
        path,
        accessToken
      )
    );

  if (
    body.error?.message
  ) {
    throw new Error(
      `threads_api_error:${body.error.message}`
    );
  }

  return body;
}

// -------------------------------------------------------
// Existing Meta helpers
// -------------------------------------------------------

async function getMetaPages(
  userAccessToken: string
): Promise<MetaPage[]> {
  const me =
    await metaGraph<{
      id?: string;
      name?: string;
    }>(
      "me?fields=id,name",
      userAccessToken
    );

  console.info(
    "[social-sync] Raw Meta /me response",
    {
      id:
        me.id ??
        null,

      name:
        me.name ??
        null,
    }
  );

  const permissions =
    await metaGraph<{
      data?: Array<{
        permission?: string;
        status?: string;
      }>;
    }>(
      "me/permissions",
      userAccessToken
    );

  console.info(
    "[social-sync] Current Meta token permissions",
    {
      permissions:
        permissions.data?.map(
          (item) => ({
            permission:
              item.permission ??
              null,

            status:
              item.status ??
              null,
          })
        ) ?? [],
    }
  );

  const response =
    await metaGraph<
      MetaPagesResponse
    >(
      "me/accounts?fields=id,name,category,access_token&limit=100",
      userAccessToken
    );

  console.info(
    "[social-sync] Raw Meta /me/accounts response",
    {
      count:
        response.data
          ?.length ??
        0,

      pages:
        response.data?.map(
          (page) => ({
            id:
              page.id,

            name:
              page.name ??
              null,

            category:
              page.category ??
              null,

            hasAccessToken:
              Boolean(
                page.access_token
              ),
          })
        ) ?? [],

      paging:
        response.paging ??
        null,
    }
  );

  const pages =
    response.data ??
    [];

  return Promise.all(
    pages.map(
      async (
        page
      ): Promise<MetaPage> => {
        const pageToken =
          page.access_token ||
          userAccessToken;

        try {
          const pageDetails =
            await metaGraph<
              MetaPageInstagramResponse
            >(
              `${page.id}?fields=id,name,instagram_business_account`,
              pageToken
            );

          console.info(
            "[social-sync] Meta Page inspected",
            {
              pageId:
                page.id,

              pageName:
                page.name ??
                null,

              instagramAccountId:
                pageDetails
                  .instagram_business_account
                  ?.id ??
                null,
            }
          );

          return {
            ...page,

            instagram_business_account:
              pageDetails
                .instagram_business_account,
          };
        } catch (error) {
          console.warn(
            "[social-sync] Could not inspect Instagram account for Page",
            {
              pageId:
                page.id,

              pageName:
                page.name ??
                null,

              error:
                error instanceof
                Error
                  ? error.message
                  : "unknown_error",
            }
          );

          return page;
        }
      }
    )
  );
}

async function getInstagramInsights(
  mediaId: string,
  accessToken: string
): Promise<{
  views: number | null;
  plays: number | null;
  reach: number | null;
  impressions: number | null;
}> {
  const result = {
    views:
      null as
        | number
        | null,

    plays:
      null as
        | number
        | null,

    reach:
      null as
        | number
        | null,

    impressions:
      null as
        | number
        | null,
  };

  const metrics = [
    "views",
    "reach",
    "plays",
    "impressions",
    "video_views",
  ];

  for (
    const metric of
    metrics
  ) {
    try {
      const response =
        await instagramGraph<
          InstagramInsightsResponse
        >(
          `${mediaId}/insights?metric=${encodeURIComponent(
            metric
          )}`,
          accessToken
        );

      for (
        const insight of
        response.data ??
        []
      ) {
        const rawValue =
          insight
            .total_value
            ?.value ??
          insight
            .values?.[0]
            ?.value;

        const numericValue =
          safeNumber(
            rawValue
          );

        if (
          numericValue ===
          null
        ) {
          continue;
        }

        if (
          insight.name ===
          "views"
        ) {
          result.views =
            numericValue;
        }

        if (
          insight.name ===
          "video_views"
        ) {
          result.views =
            numericValue;
        }

        if (
          insight.name ===
          "plays"
        ) {
          result.plays =
            numericValue;
        }

        if (
          insight.name ===
          "reach"
        ) {
          result.reach =
            numericValue;
        }

        if (
          insight.name ===
          "impressions"
        ) {
          result.impressions =
            numericValue;
        }
      }
    } catch (error) {
      console.info(
        "[social-sync] Instagram insight metric unavailable",
        {
          mediaId,
          metric,

          error:
            error instanceof
            Error
              ? error.message
              : "unknown_error",
        }
      );
    }
  }

  return result;
}

async function getFacebookPostInsights(
  postId: string,
  pageAccessToken: string
): Promise<{
  views: number | null;
  reach: number | null;
  impressions: number | null;
}> {
  const result = {
    views:
      null as
        | number
        | null,

    reach:
      null as
        | number
        | null,

    impressions:
      null as
        | number
        | null,
  };

  try {
    const response =
      await metaGraph<
        FacebookInsightsResponse
      >(
        `${postId}/insights?metric=post_impressions,post_impressions_unique,post_video_views`,
        pageAccessToken
      );

    for (
      const insight of
      response.data ??
      []
    ) {
      const numericValue =
        safeNumber(
          insight
            .values?.[0]
            ?.value
        );

      if (
        numericValue ===
        null
      ) {
        continue;
      }

      if (
        insight.name ===
        "post_impressions"
      ) {
        result.impressions =
          numericValue;
      }

      if (
        insight.name ===
        "post_impressions_unique"
      ) {
        result.reach =
          numericValue;
      }

      if (
        insight.name ===
        "post_video_views"
      ) {
        result.views =
          numericValue;
      }
    }
  } catch {
    /*
     * Inläggsinsights kan saknas beroende på sidtyp,
     * inläggstyp och Meta App Review.
     */
  }

  return result;
}

// -------------------------------------------------------
// Threads insight helpers
// -------------------------------------------------------

function readThreadsInsightValue(
  response: ThreadsInsightsResponse,
  metric: string
): number | null {
  const insight =
    (
      response.data ??
      []
    ).find(
      (item) =>
        item.name ===
        metric
    );

  if (
    !insight
  ) {
    return null;
  }

  return safeNumber(
    insight
      .total_value
      ?.value ??
      insight
        .values?.[0]
        ?.value
  );
}

async function getThreadsMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<ThreadsMediaMetrics> {
  const empty:
    ThreadsMediaMetrics = {
    views:
      null,

    likes:
      null,

    replies:
      null,

    reposts:
      null,

    quotes:
      null,

    shares:
      null,
  };

  try {
    const metrics = [
      "views",
      "likes",
      "replies",
      "reposts",
      "quotes",
      "shares",
    ];

    const response =
      await threadsGraph<
        ThreadsInsightsResponse
      >(
        `${encodeURIComponent(
          mediaId
        )}/insights?metric=${encodeURIComponent(
          metrics.join(
            ","
          )
        )}`,
        accessToken
      );

    return {
      views:
        readThreadsInsightValue(
          response,
          "views"
        ),

      likes:
        readThreadsInsightValue(
          response,
          "likes"
        ),

      replies:
        readThreadsInsightValue(
          response,
          "replies"
        ),

      reposts:
        readThreadsInsightValue(
          response,
          "reposts"
        ),

      quotes:
        readThreadsInsightValue(
          response,
          "quotes"
        ),

      shares:
        readThreadsInsightValue(
          response,
          "shares"
        ),
    };
  } catch (error) {
    /*
     * En enskild posts insights får inte stoppa
     * hela Threads-synken.
     *
     * Det kan exempelvis finnas variationer mellan
     * mediatyper eller tillgängliga mätvärden.
     */
    console.info(
      "[social-sync] Threads media insights unavailable",
      {
        mediaId,

        error:
          error instanceof
          Error
            ? error.message
            : "unknown_error",
      }
    );

    return empty;
  }
}

async function getThreadsFollowerCount(
  threadsUserId: string,
  accessToken: string
): Promise<number | null> {
  try {
    const response =
      await threadsGraph<
        ThreadsInsightsResponse
      >(
        `${encodeURIComponent(
          threadsUserId
        )}/threads_insights?metric=followers_count`,
        accessToken
      );

    return readThreadsInsightValue(
      response,
      "followers_count"
    );
  } catch (error) {
    /*
     * Followers är värdefullt men inte kritiskt
     * för en lyckad postsync.
     */
    console.info(
      "[social-sync] Threads follower count unavailable",
      {
        threadsUserId,

        error:
          error instanceof
          Error
            ? error.message
            : "unknown_error",
      }
    );

    return null;
  }
}

// -------------------------------------------------------
// YouTube API
// -------------------------------------------------------

async function youtubeApi<T>(
  url: string,
  accessToken: string
): Promise<T> {
  return fetchJson<T>(
    url,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    }
  );
}

// -------------------------------------------------------
// TikTok API
// -------------------------------------------------------

async function tiktokApi<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const body =
    await fetchJson<
      T &
        TikTokApiError
    >(
      url,
      {
        ...init,

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          ...(
            init.headers ??
            {}
          ),
        },
      }
    );

  if (
    body.error?.code &&
    body.error.code !==
      "ok"
  ) {
    throw new Error(
      `tiktok_api_error:${
        body.error
          .message ||
        body.error.code
      }`
    );
  }

  return body;
}

// -------------------------------------------------------
// LinkedIn API
// -------------------------------------------------------

async function linkedinApi<T>(
  url: string,
  accessToken: string
): Promise<T> {
  return fetchJson<T>(
    url,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "X-Restli-Protocol-Version":
          "2.0.0",
      },
    }
  );
}

// -------------------------------------------------------
// X API
// -------------------------------------------------------

async function xApi<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const body =
    await fetchJson<
      T &
        XApiError
    >(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  if (
    Array.isArray(
      body.errors
    ) &&
    body.errors.length >
      0
  ) {
    const first =
      body.errors[0];

    throw new Error(
      `x_api_error:${
        first.detail ||
        first.title ||
        "unknown_x_error"
      }`
    );
  }

  return body;
}

// -------------------------------------------------------
// Instagram sync
// -------------------------------------------------------

async function syncInstagram(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "instagram"
    );

  if (
    account.provider !==
    "meta"
  ) {
    throw new Error(
      "instagram_provider_must_be_meta"
    );
  }

  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "instagram",

      provider:
        "meta",

      skewSec:
        24 * 60 * 60,
    });

  const accessToken =
    tokenResult.accessToken;

  const profile =
    await instagramGraph<
      InstagramProfile
    >(
      [
        "me?fields=",

        encodeURIComponent(
          [
            "id",
            "user_id",
            "username",
            "name",
            "account_type",
            "biography",
            "website",
            "profile_picture_url",
            "followers_count",
            "follows_count",
            "media_count",
          ].join(",")
        ),
      ].join(""),

      accessToken
    );

  if (
    !profile.id
  ) {
    throw new Error(
      "instagram_profile_not_found"
    );
  }

  const instagramId =
    String(
      profile.id
    );

  console.info(
    "[social-sync] Direct Instagram profile resolved",
    {
      instagramId,

      instagramUserId:
        profile.user_id ??
        null,

      username:
        profile.username ??
        null,

      accountType:
        profile.account_type ??
        null,

      followersCount:
        profile.followers_count ??
        null,

      mediaCount:
        profile.media_count ??
        null,

      oauthFlow:
        "instagram_business_login",

      requiresFacebookPage:
        false,
    }
  );

  const mediaResponse =
    await instagramGraph<
      InstagramMediaResponse
    >(
      [
        `${instagramId}/media?fields=`,

        encodeURIComponent(
          [
            "id",
            "caption",
            "media_type",
            "media_product_type",
            "media_url",
            "thumbnail_url",
            "permalink",
            "timestamp",
            "like_count",
            "comments_count",
          ].join(",")
        ),

        "&limit=25",
      ].join(""),

      accessToken
    );

  const media =
    mediaResponse.data ??
    [];

  console.info(
    "[social-sync] Direct Instagram media loaded",
    {
      instagramId,

      username:
        profile.username ??
        null,

      count:
        media.length,
    }
  );

  for (
    const item of
    media
  ) {
    await upsertSocialPost(
      {
        userId,

        platform:
          "instagram",

        accountId:
          instagramId,

        postId:
          item.id,

        permalink:
          item.permalink ??
          null,

        caption:
          item.caption ??
          null,

        mediaType:
          item
            .media_product_type ||
          item.media_type ||
          null,

        postedAt:
          safeIsoDate(
            item.timestamp
          ),
      }
    );

    const insights =
      await getInstagramInsights(
        item.id,
        accessToken
      );

    await upsertSocialPostMetrics(
      {
        userId,

        platform:
          "instagram",

        postId:
          item.id,

        likes:
          safeNumber(
            item.like_count
          ),

        comments:
          safeNumber(
            item.comments_count
          ),

        views:
          insights.views,

        plays:
          insights.plays,

        reach:
          insights.reach,

        impressions:
          insights.impressions,
      }
    );
  }

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        instagramId,

      username:
        profile.username ??
        account.username,

      existingMeta:
        account.meta,

      metaPatch: {
        oauth_flow:
          "instagram_business_login",

        requires_facebook_page:
          false,

        instagram_id:
          instagramId,

        instagram_user_id:
          profile.user_id ??
          null,

        instagram_profile: {
          id:
            instagramId,

          user_id:
            profile.user_id ??
            null,

          username:
            profile.username ??
            null,

          account_type:
            profile.account_type ??
            null,

          name:
            profile.name ??
            null,

          biography:
            profile.biography ??
            null,

          website:
            profile.website ??
            null,

          profile_picture_url:
            profile
              .profile_picture_url ??
            null,

          followers_count:
            profile
              .followers_count ??
            null,

          follows_count:
            profile
              .follows_count ??
            null,

          media_count:
            profile.media_count ??
            null,
        },

        last_sync: {
          platform:
            "instagram",

          mode:
            "full",

          api:
            "instagram_login",

          at:
            now,

          items:
            media.length,
        },

        token: {
          refreshed:
            tokenResult
              .refreshed,

          expires_at:
            tokenResult
              .expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "Instagram sync complete",
    {
      platform:
        "instagram",

      mode:
        "full",

      api:
        "instagram_login",

      instagram_account_id:
        instagramId,

      synced:
        media.length,

      token_refreshed:
        tokenResult
          .refreshed,

      requires_facebook_page:
        false,
    }
  );

  return NextResponse.json(
    {
      ok: true,

      platform:
        "instagram",

      mode:
        "full",

      api:
        "instagram_login",

      accountId:
        instagramId,

      username:
        profile.username ??
        null,

      synced:
        media.length,
    }
  );
}

// -------------------------------------------------------
// Facebook sync
// -------------------------------------------------------

async function syncFacebook(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "facebook"
    );

  if (
    account.provider !==
    "meta"
  ) {
    throw new Error(
      "facebook_provider_must_be_meta"
    );
  }

  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "facebook",

      provider:
        "meta",

      skewSec:
        24 * 60 * 60,
    });

  const pages =
    await getMetaPages(
      tokenResult.accessToken
    );

  const page =
    pages.find(
      (item) =>
        item.id ===
        account.account_id
    ) ??
    pages[0];

  if (
    !page?.id
  ) {
    throw new Error(
      "no_facebook_page_found"
    );
  }

  const pageAccessToken =
    page.access_token ||
    tokenResult.accessToken;

  const postsResponse =
    await metaGraph<
      FacebookPostsResponse
    >(
      `${page.id}/posts?fields=id,message,story,created_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true)&limit=25`,
      pageAccessToken
    );

  const posts =
    postsResponse.data ??
    [];

  for (
    const post of
    posts
  ) {
    await upsertSocialPost(
      {
        userId,

        platform:
          "facebook",

        accountId:
          page.id,

        postId:
          post.id,

        permalink:
          post
            .permalink_url ??
          null,

        caption:
          post.message ??
          post.story ??
          null,

        mediaType:
          post.full_picture
            ? "media"
            : "post",

        postedAt:
          safeIsoDate(
            post.created_time
          ),
      }
    );

    const insights =
      await getFacebookPostInsights(
        post.id,
        pageAccessToken
      );

    await upsertSocialPostMetrics(
      {
        userId,

        platform:
          "facebook",

        postId:
          post.id,

        likes:
          safeNumber(
            post
              .reactions
              ?.summary
              ?.total_count
          ),

        comments:
          safeNumber(
            post
              .comments
              ?.summary
              ?.total_count
          ),

        views:
          insights.views,

        reach:
          insights.reach,

        impressions:
          insights.impressions,

        plays:
          null,
      }
    );
  }

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        page.id,

      username:
        page.name ??
        account.username,

      existingMeta:
        account.meta,

      metaPatch: {
        facebook_page: {
          id:
            page.id,

          name:
            page.name ??
            null,

          category:
            page.category ??
            null,
        },

        last_sync: {
          platform:
            "facebook",

          mode:
            "full",

          at:
            now,

          items:
            posts.length,
        },

        token: {
          refreshed:
            tokenResult
              .refreshed,

          expires_at:
            tokenResult
              .expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "Facebook sync complete",
    {
      platform:
        "facebook",

      mode:
        "full",

      synced:
        posts.length,

      token_refreshed:
        tokenResult
          .refreshed,
    }
  );

  return NextResponse.json(
    {
      ok: true,

      platform:
        "facebook",

      mode:
        "full",

      synced:
        posts.length,
    }
  );
}

// -------------------------------------------------------
// TikTok sync
// -------------------------------------------------------

async function syncTikTok(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "tiktok"
    );

  if (
    account.provider !==
    "tiktok"
  ) {
    throw new Error(
      "tiktok_provider_must_be_tiktok"
    );
  }

  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "tiktok",

      provider:
        "tiktok",

      skewSec:
        10 * 60,
    });

  const userFields = [
    "open_id",
    "union_id",
    "avatar_url",
    "avatar_url_100",
    "avatar_large_url",
    "display_name",
    "bio_description",
    "profile_deep_link",
    "is_verified",
    "username",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");

  const userResponse =
    await tiktokApi<
      TikTokUserResponse
    >(
      `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(
        userFields
      )}`,
      tokenResult.accessToken
    );

  const profile =
    userResponse.data
      ?.user;

  if (
    !profile
      ?.open_id
  ) {
    throw new Error(
      "tiktok_profile_not_found"
    );
  }

  const videoFields = [
    "id",
    "title",
    "video_description",
    "duration",
    "cover_image_url",
    "embed_link",
    "share_url",
    "create_time",
    "like_count",
    "comment_count",
    "share_count",
    "view_count",
  ].join(",");

  const videoResponse =
    await tiktokApi<
      TikTokVideoListResponse
    >(
      `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(
        videoFields
      )}`,
      tokenResult.accessToken,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            max_count:
              20,
          }),
      }
    );

  const videos =
    videoResponse.data
      ?.videos ??
    [];

  for (
    const video of
    videos
  ) {
    await upsertSocialPost(
      {
        userId,

        platform:
          "tiktok",

        accountId:
          profile.open_id,

        postId:
          video.id,

        permalink:
          video.share_url ??
          video.embed_link ??
          null,

        caption:
          video
            .video_description ??
          video.title ??
          null,

        mediaType:
          "video",

        postedAt:
          unixSecondsToIso(
            video.create_time
          ),
      }
    );

    await upsertSocialPostMetrics(
      {
        userId,

        platform:
          "tiktok",

        postId:
          video.id,

        likes:
          safeNumber(
            video.like_count
          ),

        comments:
          safeNumber(
            video.comment_count
          ),

        views:
          safeNumber(
            video.view_count
          ),

        plays:
          safeNumber(
            video.view_count
          ),

        reach:
          null,

        impressions:
          null,
      }
    );
  }

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        profile.open_id,

      username:
        profile.username ??
        profile.display_name ??
        account.username,

      existingMeta:
        account.meta,

      metaPatch: {
        open_id:
          profile.open_id,

        union_id:
          profile.union_id ??
          null,

        tiktok_profile: {
          display_name:
            profile.display_name ??
            null,

          username:
            profile.username ??
            null,

          bio_description:
            profile.bio_description ??
            null,

          avatar_url:
            profile.avatar_large_url ??
            profile.avatar_url ??
            profile.avatar_url_100 ??
            null,

          profile_deep_link:
            profile.profile_deep_link ??
            null,

          is_verified:
            profile.is_verified ??
            null,

          follower_count:
            profile.follower_count ??
            null,

          following_count:
            profile.following_count ??
            null,

          likes_count:
            profile.likes_count ??
            null,

          video_count:
            profile.video_count ??
            null,
        },

        last_sync: {
          platform:
            "tiktok",

          mode:
            "full",

          at:
            now,

          items:
            videos.length,

          has_more:
            videoResponse
              .data
              ?.has_more ??
            false,
        },

        token: {
          refreshed:
            tokenResult
              .refreshed,

          expires_at:
            tokenResult
              .expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "TikTok sync complete",
    {
      platform:
        "tiktok",

      mode:
        "full",

      synced:
        videos.length,

      token_refreshed:
        tokenResult
          .refreshed,
    }
  );

  return NextResponse.json(
    {
      ok: true,

      platform:
        "tiktok",

      mode:
        "full",

      synced:
        videos.length,
    }
  );
}

// -------------------------------------------------------
// YouTube sync
// -------------------------------------------------------

async function syncYouTube(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "youtube"
    );

  if (
    account.provider !==
    "google"
  ) {
    throw new Error(
      "youtube_provider_must_be_google"
    );
  }

  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "youtube",

      provider:
        "google",

      skewSec:
        10 * 60,
    });

  const channelResponse =
    await youtubeApi<
      YouTubeChannelResponse
    >(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      tokenResult.accessToken
    );

  const channel =
    channelResponse
      .items?.[0];

  if (
    !channel?.id
  ) {
    throw new Error(
      "youtube_no_channel_found"
    );
  }

  const searchResponse =
    await youtubeApi<
      YouTubeSearchResponse
    >(
      "https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=25&order=date",
      tokenResult.accessToken
    );

  const videoIds =
    (
      searchResponse.items ??
      []
    )
      .map(
        (item) =>
          item.id
            ?.videoId
      )
      .filter(
        (
          videoId
        ): videoId is string =>
          Boolean(
            videoId
          )
      );

  let videos:
    NonNullable<
      YouTubeVideosResponse["items"]
    > = [];

  if (
    videoIds.length >
    0
  ) {
    const videoResponse =
      await youtubeApi<
        YouTubeVideosResponse
      >(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(
          videoIds.join(",")
        )}`,
        tokenResult.accessToken
      );

    videos =
      videoResponse.items ??
      [];
  }

  for (
    const video of
    videos
  ) {
    const caption =
      video.snippet
        ?.title
        ? video.snippet
            .description
          ? `${video.snippet.title}\n\n${video.snippet.description}`
          : video.snippet.title
        : video.snippet
            ?.description ??
          null;

    await upsertSocialPost(
      {
        userId,

        platform:
          "youtube",

        accountId:
          channel.id,

        postId:
          video.id,

        permalink:
          `https://www.youtube.com/watch?v=${encodeURIComponent(
            video.id
          )}`,

        caption,

        mediaType:
          "video",

        postedAt:
          safeIsoDate(
            video
              .snippet
              ?.publishedAt
          ),
      }
    );

    await upsertSocialPostMetrics(
      {
        userId,

        platform:
          "youtube",

        postId:
          video.id,

        likes:
          safeNumber(
            video
              .statistics
              ?.likeCount
          ),

        comments:
          safeNumber(
            video
              .statistics
              ?.commentCount
          ),

        views:
          safeNumber(
            video
              .statistics
              ?.viewCount
          ),

        plays:
          null,

        reach:
          null,

        impressions:
          null,
      }
    );
  }

  const channelTitle =
    channel.snippet
      ?.title ||
    "YouTube channel";

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        channel.id,

      username:
        channelTitle,

      existingMeta:
        account.meta,

      metaPatch: {
        channel: {
          id:
            channel.id,

          title:
            channelTitle,

          description:
            channel
              .snippet
              ?.description ??
            null,

          custom_url:
            channel
              .snippet
              ?.customUrl ??
            null,

          profile_picture_url:
            channel
              .snippet
              ?.thumbnails
              ?.high
              ?.url ??
            channel
              .snippet
              ?.thumbnails
              ?.medium
              ?.url ??
            channel
              .snippet
              ?.thumbnails
              ?.default
              ?.url ??
            null,

          statistics:
            channel.statistics ??
            null,
        },

        last_sync: {
          platform:
            "youtube",

          mode:
            "full",

          at:
            now,

          items:
            videos.length,
        },

        token: {
          refreshed:
            tokenResult
              .refreshed,

          expires_at:
            tokenResult
              .expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "YouTube sync complete",
    {
      platform:
        "youtube",

      mode:
        "full",

      synced:
        videos.length,

      token_refreshed:
        tokenResult
          .refreshed,
    }
  );

  return NextResponse.json(
    {
      ok: true,

      platform:
        "youtube",

      mode:
        "full",

      synced:
        videos.length,
    }
  );
}

// -------------------------------------------------------
// Threads sync
// -------------------------------------------------------

async function syncThreads(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "threads"
    );

  if (
    account.provider !==
    "meta"
  ) {
    throw new Error(
      "threads_provider_must_be_meta"
    );
  }

  /*
   * Threads has its own refresh logic inside
   * lib/socialTokens.ts.
   *
   * Do not send this token through Facebook's
   * fb_exchange_token flow.
   */
  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "threads",

      provider:
        "meta",
    });

  const accessToken =
    tokenResult.accessToken;

  /*
   * Resolve the actual Threads profile again.
   *
   * This verifies that the stored token still belongs
   * to a real Threads user and refreshes profile data.
   */
  const profileFields = [
    "id",
    "username",
    "name",
    "threads_profile_picture_url",
    "threads_biography",
    "is_verified",
  ].join(",");

  const profile =
    await threadsGraph<
      ThreadsProfile
    >(
      `me?fields=${encodeURIComponent(
        profileFields
      )}`,
      accessToken
    );

  if (
    !profile.id
  ) {
    throw new Error(
      "threads_profile_not_found"
    );
  }

  const threadsUserId =
    String(
      profile.id
    );

  /*
   * Retrieve the user's latest Threads posts.
   *
   * No publishing permission is required for this
   * read-only Autoaffi flow.
   */
  const postFields = [
    "id",
    "media_product_type",
    "media_type",
    "media_url",
    "permalink",
    "username",
    "text",
    "timestamp",
    "shortcode",
    "thumbnail_url",
    "is_quote_post",
    "alt_text",
  ].join(",");

  const postsResponse =
    await threadsGraph<
      ThreadsPostsResponse
    >(
      `${encodeURIComponent(
        threadsUserId
      )}/threads?fields=${encodeURIComponent(
        postFields
      )}&limit=25`,
      accessToken
    );

  const posts =
    postsResponse.data ??
    [];

  console.info(
    "[social-sync] Threads posts loaded",
    {
      threadsUserId,

      username:
        profile.username ??
        null,

      count:
        posts.length,
    }
  );

  /*
   * Existing normalized DB columns:
   *
   * Threads likes   -> social_post_metrics.likes
   * Threads replies -> social_post_metrics.comments
   * Threads views   -> social_post_metrics.views
   *
   * Reposts, quotes and shares currently have no
   * dedicated normalized Supabase columns.
   *
   * We preserve them in account metadata rather than
   * changing the existing DB schema during this pass.
   */
  const extraPostMetrics:
    Array<{
      post_id: string;
      reposts: number | null;
      quotes: number | null;
      shares: number | null;
    }> = [];

  const allMetrics:
    ThreadsMediaMetrics[] = [];

  for (
    const post of
    posts
  ) {
    await upsertSocialPost(
      {
        userId,

        platform:
          "threads",

        accountId:
          threadsUserId,

        postId:
          post.id,

        permalink:
          post.permalink ??
          null,

        caption:
          post.text ??
          null,

        mediaType:
          post.media_product_type ??
          post.media_type ??
          "post",

        postedAt:
          safeIsoDate(
            post.timestamp
          ),
      }
    );

    const insights =
      await getThreadsMediaInsights(
        post.id,
        accessToken
      );

    allMetrics.push(
      insights
    );

    extraPostMetrics.push(
      {
        post_id:
          post.id,

        reposts:
          insights.reposts,

        quotes:
          insights.quotes,

        shares:
          insights.shares,
      }
    );

    await upsertSocialPostMetrics(
      {
        userId,

        platform:
          "threads",

        postId:
          post.id,

        likes:
          insights.likes,

        /*
         * Autoaffi's normalized comments column
         * represents reply/comment interaction.
         */
        comments:
          insights.replies,

        views:
          insights.views,

        plays:
          null,

        reach:
          null,

        impressions:
          null,
      }
    );
  }

  /*
   * Followers are account-level Threads insight data.
   *
   * Failure here should not invalidate an otherwise
   * successful post sync.
   */
  const followersCount =
    await getThreadsFollowerCount(
      threadsUserId,
      accessToken
    );

  /*
   * Build a useful summary from the exact posts
   * retrieved in this sync.
   *
   * These are NOT fabricated values and they are not
   * presented as all-time account totals.
   */
  const syncedPostSummary = {
    posts:
      posts.length,

    views:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.views
        )
      ),

    likes:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.likes
        )
      ),

    replies:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.replies
        )
      ),

    reposts:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.reposts
        )
      ),

    quotes:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.quotes
        )
      ),

    shares:
      sumKnownNumbers(
        allMetrics.map(
          (item) =>
            item.shares
        )
      ),
  };

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        threadsUserId,

      username:
        profile.username ??
        account.username,

      existingMeta:
        account.meta,

      metaPatch: {
        oauth_flow:
          "threads_oauth",

        threads_user_id:
          threadsUserId,

        threads_profile: {
          id:
            threadsUserId,

          username:
            profile.username ??
            null,

          display_name:
            profile.name ??
            null,

          profile_picture_url:
            profile
              .threads_profile_picture_url ??
            null,

          biography:
            profile
              .threads_biography ??
            null,

          is_verified:
            profile
              .is_verified ??
            null,

          followers_count:
            followersCount,
        },

        /*
         * Summary from this synced post window.
         *
         * Never label these values as all-time totals.
         */
        threads_synced_post_summary:
          syncedPostSummary,

        /*
         * Preserve Threads-native engagement signals
         * that do not yet have normalized columns in
         * social_post_metrics.
         */
        threads_extra_post_metrics:
          extraPostMetrics,

        last_sync: {
          platform:
            "threads",

          mode:
            "full",

          api:
            "threads_graph",

          at:
            now,

          items:
            posts.length,

          followers_count:
            followersCount,
        },

        token: {
          refreshed:
            tokenResult.refreshed,

          expires_at:
            tokenResult.expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "Threads sync complete",
    {
      platform:
        "threads",

      mode:
        "full",

      api:
        "threads_graph",

      threads_user_id:
        threadsUserId,

      synced:
        posts.length,

      followers_count:
        followersCount,

      token_refreshed:
        tokenResult.refreshed,
    }
  );

  return NextResponse.json(
    {
      ok:
        true,

      platform:
        "threads",

      mode:
        "full",

      api:
        "threads_graph",

      accountId:
        threadsUserId,

      username:
        profile.username ??
        null,

      followers:
        followersCount,

      synced:
        posts.length,
    }
  );
}

// -------------------------------------------------------
// LinkedIn sync
// -------------------------------------------------------

function normalizeLinkedInLocale(
  locale:
    LinkedInUserInfo["locale"]
): string | null {
  if (
    !locale
  ) {
    return null;
  }

  if (
    typeof locale ===
    "string"
  ) {
    return locale;
  }

  const language =
    locale.language
      ?.trim();

  const country =
    locale.country
      ?.trim();

  if (
    language &&
    country
  ) {
    return `${language}-${country}`;
  }

  return (
    language ||
    country ||
    null
  );
}

async function syncLinkedIn(
  userId: string,
  runId: string
): Promise<NextResponse> {
  const account =
    await getConnectedAccount(
      userId,
      "linkedin"
    );

  if (
    account.provider !==
    "linkedin"
  ) {
    throw new Error(
      "linkedin_provider_must_be_linkedin"
    );
  }

  const tokenResult =
    await getValidAccessToken({
      userId,

      platform:
        "linkedin",

      provider:
        "linkedin",

      skewSec:
        10 * 60,
    });

  const profile =
    await linkedinApi<
      LinkedInUserInfo
    >(
      "https://api.linkedin.com/v2/userinfo",
      tokenResult.accessToken
    );

  if (
    !profile.sub
  ) {
    throw new Error(
      "linkedin_profile_not_found"
    );
  }

  const now =
    new Date()
      .toISOString();

  await updateConnectedAccount(
    {
      rowId:
        account.id,

      accountId:
        profile.sub,

      username:
        profile.name ??
        profile.email ??
        account.username,

      existingMeta:
        account.meta,

      metaPatch: {
        linkedin_member_id:
          profile.sub,

        linkedin_profile: {
          display_name:
            profile.name ??
            null,

          given_name:
            profile.given_name ??
            null,

          family_name:
            profile.family_name ??
            null,

          profile_picture_url:
            profile.picture ??
            null,

          email:
            profile.email ??
            null,

          email_verified:
            profile.email_verified ??
            null,

          locale:
            normalizeLinkedInLocale(
              profile.locale
            ),
        },

        last_sync: {
          platform:
            "linkedin",

          mode:
            "profile",

          at:
            now,

          items:
            0,

          note:
            "Profile synced. Member post analytics require additional LinkedIn product approval.",
        },

        token: {
          refreshed:
            tokenResult.refreshed,

          expires_at:
            tokenResult.expiresAt,
        },
      },
    }
  );

  await finishRunOk(
    runId,
    "LinkedIn profile sync complete",
    {
      platform:
        "linkedin",

      mode:
        "profile",

      synced:
        0,

      token_refreshed:
        tokenResult.refreshed,
    }
  );

  return NextResponse.json(
    {
      ok:
        true,

      platform:
        "linkedin",

      mode:
        "profile",

      synced:
        0,

      note:
        "LinkedIn profile synced. Post analytics require additional LinkedIn approval.",
    }
  );
}

// -------------------------------------------------------
// Main route
// -------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  const session =
    await getServerSession(
      authOptions
    );

  const sessionUserId =
    session?.user?.id;

  if (
    !sessionUserId
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "unauthorized",
      },
      {
        status:
          401,
      }
    );
  }

  const userId =
    String(
      sessionUserId
    );

  if (
    !isUuid(
      userId
    )
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "session_user_id_not_uuid",

        hint:
          "NextAuth session.user.id must contain the canonical Supabase user UUID.",
      },
      {
        status:
          401,
      }
    );
  }

  const body =
    await req
      .json()
      .catch(
        () => ({})
      );

  let platform:
    Platform;

  try {
    platform =
      normalizePlatform(
        getObject(
          body
        ).platform
      );
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "invalid_platform",
      },
      {
        status:
          400,
      }
    );
  }

  let runId:
    string;

  try {
    runId =
      await createRun(
        userId,
        platform
      );
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "sync_run_create_failed",
      },
      {
        status:
          500,
      }
    );
  }

  try {
    switch (
      platform
    ) {
      case "instagram":
        return await syncInstagram(
          userId,
          runId
        );

      case "facebook":
        return await syncFacebook(
          userId,
          runId
        );

      case "tiktok":
        return await syncTikTok(
          userId,
          runId
        );

      case "youtube":
        return await syncYouTube(
          userId,
          runId
        );

      case "threads":
        return await syncThreads(
          userId,
          runId
        );

      case "linkedin":
        return await syncLinkedIn(
          userId,
          runId
        );

    default:
        throw new Error(
          "unsupported_platform"
        );
    }
  } catch (error) {
    const message =
      error instanceof
      Error
        ? error.message
        : "sync_failed";

    console.error(
      "[social-sync] Platform sync failed",
      {
        userId,
        platform,
        runId,

        error:
          message,
      }
    );

    const publicError =
      publicSyncError(
        message
      );

    await finishRunError(
      runId,
      message,
      {
        platform,

        public_error:
          publicError.error,
      }
    );

    return NextResponse.json(
      {
        ok:
          false,

        platform,

        error:
          publicError.error,

        detail:
          process.env
            .NODE_ENV ===
          "development"
            ? message
            : undefined,
      },
      {
        status:
          publicError.status,
      }
    );
  }
}