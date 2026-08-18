// app/api/social/disconnect/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptToken } from "@/lib/socialCrypto";

export const runtime = "nodejs";

type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "threads"
  | "linkedin";

function normalizePlatform(
  value: unknown
): Platform | null {
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
    platform === "linkedin"
  ) {
    return platform;
  }

  return null;
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// -------------------------------------------------------
// Optional cleanup toggle
// -------------------------------------------------------

/*
 * false:
 *
 * Disconnect removes active credentials/identity but keeps
 * historical social_posts / social_post_metrics.
 *
 * This allows Autoaffi to retain historical performance
 * unless we explicitly decide otherwise later.
 */
const CLEANUP_POSTS_ON_DISCONNECT =
  false;

// -------------------------------------------------------
// Runs
// -------------------------------------------------------

async function createRun(
  userId: string,
  platform: Platform
): Promise<string> {
  const runInsert =
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
          "Disconnect started",
      })
      .select()
      .single();

  const runId =
    runInsert.data
      ?.id;

  if (
    runInsert.error ||
    !runId
  ) {
    throw new Error(
      runInsert.error
        ?.message ||
        "disconnect_run_create_failed"
    );
  }

  return String(
    runId
  );
}

async function finishRunOk(
  runId: string,
  message: string,
  meta?: unknown
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
      "[social-disconnect] Failed to finish successful run",
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
  meta?: unknown
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
      "[social-disconnect] Failed to finish failed run",
      {
        runId,

        error:
          error.message,
      }
    );
  }
}

// -------------------------------------------------------
// Provider revoke helpers — best effort only
// -------------------------------------------------------

/*
 * Facebook / Instagram Meta revoke.
 *
 * IMPORTANT:
 *
 * Threads tokens must NOT be sent here.
 *
 * Threads uses its own Graph API/token flow.
 */
async function revokeMetaPermissions(
  accessToken: string
): Promise<unknown> {
  const url =
    `https://graph.facebook.com/v20.0/me/permissions` +
    `?access_token=${encodeURIComponent(
      accessToken
    )}`;

  const response =
    await fetch(
      url,
      {
        method:
          "DELETE",

        cache:
          "no-store",
      }
    );

  const json =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {
    const body =
      json &&
      typeof json ===
        "object" &&
      !Array.isArray(
        json
      )
        ? (
            json as Record<
              string,
              any
            >
          )
        : {};

    const message =
      body?.error
        ?.message ||
      "meta_revoke_failed";

    throw new Error(
      message
    );
  }

  return json;
}

/*
 * Google revoke.
 */
async function revokeGoogleToken(
  token: string
): Promise<{
  ok: true;
}> {
  const response =
    await fetch(
      "https://oauth2.googleapis.com/revoke",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            token,
          }),

        cache:
          "no-store",
      }
    );

  if (
    !response.ok
  ) {
    const text =
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      text ||
        "google_revoke_failed"
    );
  }

  return {
    ok:
      true,
  };
}

// -------------------------------------------------------
// Metadata helpers
// -------------------------------------------------------

function getMetaObject(
  meta: unknown
): Record<
  string,
  unknown
> {
  if (
    typeof meta ===
      "object" &&
    meta !== null &&
    !Array.isArray(
      meta
    )
  ) {
    return {
      ...(
        meta as Record<
          string,
          unknown
        >
      ),
    };
  }

  return {};
}

function safeStripLastSync(
  meta: unknown
): Record<
  string,
  unknown
> {
  const next =
    getMetaObject(
      meta
    );

  delete next.last_sync;

  return next;
}

/*
 * -------------------------------------------------------
 * LinkedIn-specific cleanup
 * -------------------------------------------------------
 *
 * LinkedIn does not currently use a provider revoke
 * endpoint in this Autoaffi flow.
 *
 * We therefore destroy its stored tokens below and remove
 * stale active identity/OAuth metadata here.
 */
function stripLinkedInConnectionMeta(
  meta: unknown
): Record<
  string,
  unknown
> {
  const next =
    getMetaObject(
      meta
    );

  delete next.oauth_connected_at;

  delete next.linkedin_member_id;
  delete next.linkedin_profile;

  delete next.display_name;
  delete next.given_name;
  delete next.family_name;

  delete next.profile_picture_url;

  delete next.email;
  delete next.email_verified;

  delete next.locale;

  delete next.token_type;
  delete next.granted_scopes;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  delete next.token;
  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  return next;
}

/*
 * -------------------------------------------------------
 * Threads-specific cleanup
 * -------------------------------------------------------
 *
 * Threads remains:
 *
 * platform = "threads"
 * provider = "meta"
 *
 * But its token must never be treated like a Facebook
 * User Access Token.
 *
 * On disconnect we remove active Threads OAuth/profile
 * identity metadata.
 *
 * We intentionally retain historical analytics summaries
 * such as:
 *
 * threads_synced_post_summary
 * threads_extra_post_metrics
 *
 * because CLEANUP_POSTS_ON_DISCONNECT is false and
 * Autoaffi currently preserves historical performance.
 */
function stripThreadsConnectionMeta(
  meta: unknown
): Record<
  string,
  unknown
> {
  const next =
    getMetaObject(
      meta
    );

  delete next.oauth_connected_at;
  delete next.oauth_flow;

  delete next.threads_user_id;
  delete next.short_token_user_id;

  delete next.username;
  delete next.display_name;

  delete next.profile_picture_url;
  delete next.biography;

  delete next.threads_profile;

  delete next.token_type;

  delete next.requested_scopes;
  delete next.granted_scopes;

  delete next.publishing_enabled;
  delete next.insights_requested;
  delete next.replies_requested;

  delete next.token;

  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  return next;
}

function buildDisconnectBaseMeta(
  platform: Platform,
  meta: unknown
): Record<
  string,
  unknown
> {
  const withoutLastSync =
    safeStripLastSync(
      meta
    );

  if (
    platform ===
    "linkedin"
  ) {
    return stripLinkedInConnectionMeta(
      withoutLastSync
    );
  }

  if (
    platform ===
    "threads"
  ) {
    return stripThreadsConnectionMeta(
      withoutLastSync
    );
  }

  /*
   * Instagram / Facebook / TikTok / YouTube retain
   * their existing metadata behavior.
   */
  return withoutLastSync;
}

// -------------------------------------------------------
// Main
// -------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  const session =
    await getServerSession(
      authOptions
    );

  const userIdRaw =
    (
      session as {
        user?: {
          id?: unknown;
        };
      } | null
    )?.user?.id;

  if (
    !userIdRaw
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
      userIdRaw
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

        received:
          userId,

        hint:
          "Fix NextAuth callbacks: session.user.id måste vara Supabase user UUID.",
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

  const bodyObject =
    body &&
    typeof body ===
      "object" &&
    !Array.isArray(
      body
    )
      ? (
          body as Record<
            string,
            unknown
          >
        )
      : {};

  const platform =
    normalizePlatform(
      bodyObject.platform
    );

  if (
    !platform
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "invalid_platform",

        allowed: [
          "instagram",
          "facebook",
          "tiktok",
          "youtube",
          "threads",
          "linkedin",
        ],
      },
      {
        status:
          400,
      }
    );
  }

  let runId =
    "";

  try {
    runId =
      await createRun(
        userId,
        platform
      );
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "disconnect_run_create_failed",
      },
      {
        status:
          500,
      }
    );
  }

  // -----------------------------------------------------
  // Read account
  // -----------------------------------------------------
  //
  // Idempotent:
  //
  // no row => already disconnected.
  //

  let account:
    Record<
      string,
      any
    > | null =
    null;

  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "user_social_accounts"
        )
        .select("*")
        .eq(
          "user_id",
          userId
        )
        .eq(
          "platform",
          platform
        )
        .maybeSingle();

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    account =
      data ??
      null;
  } catch (
    error
  ) {
    const detail =
      error instanceof
      Error
        ? error.message
        : "unknown_error";

    await finishRunError(
      runId,
      "account_read_failed",
      {
        platform,
        detail,
      }
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "account_read_failed",
      },
      {
        status:
          500,
      }
    );
  }

  if (
    !account
  ) {
    await finishRunOk(
      runId,
      "No account row found; already disconnected",
      {
        platform,

        already:
          true,
      }
    );

    return NextResponse.json(
      {
        ok:
          true,

        platform,

        alreadyDisconnected:
          true,
      }
    );
  }

  const alreadyDisconnected =
    String(
      account.status
    ) ===
    "disconnected";

  const revoke: {
    attempted: boolean;
    ok: boolean;
    provider?: string;
    error?: string;
  } = {
    attempted:
      false,

    ok:
      false,
  };

  // -----------------------------------------------------
  // Best-effort provider revoke
  // -----------------------------------------------------

  try {
    /*
     * ---------------------------------------------------
     * Instagram / Facebook
     * ---------------------------------------------------
     *
     * Threads is intentionally NOT included here.
     */
    if (
      (
        platform ===
          "instagram" ||
        platform ===
          "facebook"
      ) &&
      account.provider ===
        "meta" &&
      account.access_token_enc
    ) {
      revoke.attempted =
        true;

      revoke.provider =
        "meta";

      const token =
        decryptToken(
          String(
            account.access_token_enc
          )
        );

      await revokeMetaPermissions(
        token
      );

      revoke.ok =
        true;
    }

    /*
     * ---------------------------------------------------
     * YouTube / Google
     * ---------------------------------------------------
     */
    if (
      platform ===
        "youtube" &&
      account.provider ===
        "google"
    ) {
      const access =
        account.access_token_enc
          ? decryptToken(
              String(
                account.access_token_enc
              )
            )
          : null;

      const refresh =
        account.refresh_token_enc
          ? decryptToken(
              String(
                account.refresh_token_enc
              )
            )
          : null;

      if (
        access ||
        refresh
      ) {
        revoke.attempted =
          true;

        revoke.provider =
          "google";

        await revokeGoogleToken(
          String(
            access ||
            refresh
          )
        );

        revoke.ok =
          true;
      }
    }

    /*
     * ---------------------------------------------------
     * Threads
     * ---------------------------------------------------
     *
     * No Facebook revoke call.
     *
     * Autoaffi destroys its encrypted Threads tokens and
     * active identity metadata in the DB cleanup below.
     *
     * Provider-side uninstall/data-deletion handling is
     * implemented separately.
     */

    /*
     * ---------------------------------------------------
     * LinkedIn
     * ---------------------------------------------------
     *
     * Autoaffi does not invent an undocumented remote
     * revoke endpoint.
     *
     * Stored credentials and LinkedIn connection metadata
     * are destroyed below.
     */
  } catch (
    error
  ) {
    revoke.ok =
      false;

    revoke.error =
      error instanceof
      Error
        ? error.message
        : "revoke_failed";
  }

  // -----------------------------------------------------
  // DB clean
  // -----------------------------------------------------

  try {
    const baseMeta =
      buildDisconnectBaseMeta(
        platform,
        account.meta
      );

    const now =
      new Date()
        .toISOString();

    const nextMeta = {
      ...baseMeta,

      disconnected_at:
        now,

      disconnected_by:
        "user",

      disconnected_platform:
        platform,

      disconnect_revoke:
        revoke,

      previous_status:
        account.status ??
        null,
    };

    const {
      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "user_social_accounts"
        )
        .update({
          status:
            "disconnected",

          /*
           * Destroy provider credentials.
           */
          access_token_enc:
            null,

          refresh_token_enc:
            null,

          token_expires_at:
            null,

          /*
           * Remove active provider identity.
           */
          account_id:
            null,

          username:
            null,

          meta:
            nextMeta,

          updated_at:
            now,
        })
        .eq(
          "id",
          account.id
        );

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }
  } catch (
    error
  ) {
    const detail =
      error instanceof
      Error
        ? error.message
        : "unknown";

    await finishRunError(
      runId,
      "disconnect_db_update_failed",
      {
        platform,
        revoke,
        detail,
      }
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "disconnect_db_update_failed",

        detail,
      },
      {
        status:
          500,
      }
    );
  }

  // -----------------------------------------------------
  // Optional historical content cleanup
  // -----------------------------------------------------

  if (
    CLEANUP_POSTS_ON_DISCONNECT
  ) {
    try {
      const {
        error:
          metricsError,
      } =
        await supabaseAdmin
          .from(
            "social_post_metrics"
          )
          .delete()
          .eq(
            "user_id",
            userId
          )
          .eq(
            "platform",
            platform
          );

      if (
        metricsError
      ) {
        throw new Error(
          metricsError.message
        );
      }

      const {
        error:
          postsError,
      } =
        await supabaseAdmin
          .from(
            "social_posts"
          )
          .delete()
          .eq(
            "user_id",
            userId
          )
          .eq(
            "platform",
            platform
          );

      if (
        postsError
      ) {
        throw new Error(
          postsError.message
        );
      }
    } catch (
      error
    ) {
      const detail =
        error instanceof
        Error
          ? error.message
          : "cleanup_failed";

      await finishRunError(
        runId,
        "disconnected_but_cleanup_failed",
        {
          platform,
          revoke,

          cleanup: {
            ok:
              false,

            error:
              detail,
          },
        }
      );

      return NextResponse.json(
        {
          ok:
            true,

          platform,

          revoked:
            revoke,

          cleanup: {
            ok:
              false,

            error:
              detail,
          },

          message:
            "Disconnected (cleanup failed — safe to reconnect).",
        }
      );
    }
  }

  // -----------------------------------------------------
  // Finish
  // -----------------------------------------------------

  await finishRunOk(
    runId,

    alreadyDisconnected
      ? "Already disconnected (refreshed state)"
      : "Disconnected",

    {
      platform,

      revoke,

      alreadyDisconnected,

      cleanup:
        CLEANUP_POSTS_ON_DISCONNECT
          ? {
              ok:
                true,
            }
          : {
              skipped:
                true,
            },

      linkedinMetadataCleared:
        platform ===
        "linkedin",

      threadsMetadataCleared:
        platform ===
        "threads",
    }
  );

  // -----------------------------------------------------
  // Response
  // -----------------------------------------------------

  return NextResponse.json(
    {
      ok:
        true,

      platform,

      alreadyDisconnected,

      revoked:
        revoke,

      cleanup:
        CLEANUP_POSTS_ON_DISCONNECT
          ? {
              ok:
                true,
            }
          : {
              skipped:
                true,
            },

      message:
        revoke.attempted
          ? revoke.ok
            ? "Disconnected + revoke attempted successfully."
            : "Disconnected (revoke failed — token may be expired, safe to reconnect)."
          : "Disconnected.",
    }
  );
}