import { NextRequest, NextResponse } from "next/server";
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
  | "linkedin"
  | "x";

function normalizePlatform(v: any): Platform | null {
  const p = String(v || "")
    .toLowerCase()
    .trim();

  if (
    p === "instagram" ||
    p === "facebook" ||
    p === "tiktok" ||
    p === "youtube" ||
    p === "linkedin" ||
    p === "x"
  ) {
    return p;
  }

  return null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// -------------------- Optional cleanup toggle --------------------

const CLEANUP_POSTS_ON_DISCONNECT = false;

// -------------------- Runs --------------------

async function createRun(
  userId: string,
  platform: Platform
) {
  const runInsert = await supabaseAdmin
    .from("social_sync_runs")
    .insert({
      user_id: userId,
      platform,
      status: "running",
      message: "Disconnect started",
    })
    .select()
    .single();

  const runId = runInsert.data?.id;

  if (runInsert.error || !runId) {
    throw new Error(
      runInsert.error?.message ||
        "disconnect_run_create_failed"
    );
  }

  return String(runId);
}

async function finishRunOk(
  runId: string,
  message: string,
  meta?: any
) {
  await supabaseAdmin
    .from("social_sync_runs")
    .update({
      status: "ok",
      message,
      meta: meta ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function finishRunError(
  runId: string,
  message: string,
  meta?: any
) {
  await supabaseAdmin
    .from("social_sync_runs")
    .update({
      status: "error",
      message,
      meta: meta ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

// -------------------- Revoke helpers (best effort) --------------------

// Meta revoke: DELETE /me/permissions
async function revokeMetaPermissions(
  accessToken: string
) {
  const url =
    `https://graph.facebook.com/v20.0/me/permissions` +
    `?access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, {
    method: "DELETE",
    cache: "no-store",
  });

  const json = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      "meta_revoke_failed";

    throw new Error(msg);
  }

  return json;
}

// Google revoke: POST oauth2.googleapis.com/revoke
async function revokeGoogleToken(
  token: string
) {
  const res = await fetch(
    "https://oauth2.googleapis.com/revoke",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res
      .text()
      .catch(() => "");

    throw new Error(
      text || "google_revoke_failed"
    );
  }

  return {
    ok: true,
  };
}

// -------------------- Metadata cleanup --------------------

function safeStripLastSync(meta: any) {
  const prev =
    meta &&
    typeof meta === "object" &&
    !Array.isArray(meta)
      ? { ...meta }
      : {};

  delete prev.last_sync;

  return prev;
}

/**
 * LinkedIn-specific disconnect cleanup.
 *
 * IMPORTANT:
 * This function is ONLY used for LinkedIn.
 * Meta / Google / TikTok / X metadata is untouched.
 *
 * We remove LinkedIn identity and OAuth metadata so that
 * "Remove" leaves no stale LinkedIn profile/token state
 * inside user_social_accounts.meta.
 */
function stripLinkedInConnectionMeta(meta: any) {
  const next =
    meta &&
    typeof meta === "object" &&
    !Array.isArray(meta)
      ? { ...meta }
      : {};

  delete next.oauth_connected_at;

  delete next.linkedin_member_id;

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

  return next;
}

function buildDisconnectBaseMeta(
  platform: Platform,
  meta: any
) {
  const withoutLastSync =
    safeStripLastSync(meta);

  if (platform === "linkedin") {
    return stripLinkedInConnectionMeta(
      withoutLastSync
    );
  }

  // IMPORTANT:
  // Other platforms retain the exact same metadata
  // behavior as before.
  return withoutLastSync;
}

// -------------------- Main --------------------

export async function POST(
  req: NextRequest
) {
  const session =
    await getServerSession(authOptions);

  const userIdRaw =
    (session as any)?.user?.id;

  if (!userIdRaw) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const userId = String(userIdRaw);

  if (!isUuid(userId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "session_user_id_not_uuid",
        received: userId,
        hint:
          "Fix NextAuth callbacks: session.user.id måste vara Supabase user UUID.",
      },
      {
        status: 401,
      }
    );
  }

  const body = await req
    .json()
    .catch(() => ({}));

  const platform =
    normalizePlatform(body?.platform);

  if (!platform) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_platform",
        allowed: [
          "instagram",
          "facebook",
          "tiktok",
          "youtube",
          "linkedin",
          "x",
        ],
      },
      {
        status: 400,
      }
    );
  }

  let runId = "";

  try {
    runId = await createRun(
      userId,
      platform
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ||
          "disconnect_run_create_failed",
      },
      {
        status: 500,
      }
    );
  }

  // -------------------- Read account --------------------
  // Idempotent: finns ingen row => already disconnected.

  let acc: any | null = null;

  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("user_social_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    acc = data || null;
  } catch (e: any) {
    await finishRunError(
      runId,
      "account_read_failed",
      {
        platform,
        detail: e?.message,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        error: "account_read_failed",
      },
      {
        status: 500,
      }
    );
  }

  if (!acc) {
    await finishRunOk(
      runId,
      "No account row found; already disconnected",
      {
        platform,
        already: true,
      }
    );

    return NextResponse.json({
      ok: true,
      platform,
      alreadyDisconnected: true,
    });
  }

  const alreadyDisconnected =
    String(acc.status) ===
    "disconnected";

  const revoke: {
    attempted: boolean;
    ok: boolean;
    provider?: string;
    error?: string;
  } = {
    attempted: false,
    ok: false,
  };

  // -------------------- Best-effort provider revoke --------------------

  try {
    // Meta revoke (Instagram / Facebook)
    if (
      (
        platform === "instagram" ||
        platform === "facebook"
      ) &&
      acc?.provider === "meta" &&
      acc?.access_token_enc
    ) {
      revoke.attempted = true;
      revoke.provider = "meta";

      const token = decryptToken(
        acc.access_token_enc
      );

      await revokeMetaPermissions(token);

      revoke.ok = true;
    }

    // Google revoke (YouTube)
    if (
      platform === "youtube" &&
      acc?.provider === "google"
    ) {
      const access =
        acc?.access_token_enc
          ? decryptToken(
              acc.access_token_enc
            )
          : null;

      const refresh =
        acc?.refresh_token_enc
          ? decryptToken(
              acc.refresh_token_enc
            )
          : null;

      if (access || refresh) {
        revoke.attempted = true;
        revoke.provider = "google";

        await revokeGoogleToken(
          String(access || refresh)
        );

        revoke.ok = true;
      }
    }

    /*
     * LinkedIn:
     *
     * We intentionally do NOT invent/use an undocumented
     * provider revoke endpoint here.
     *
     * Autoaffi disconnects LinkedIn by securely destroying
     * its locally stored access/refresh tokens below and
     * clearing LinkedIn-specific identity/OAuth metadata.
     */
  } catch (e: any) {
    revoke.ok = false;
    revoke.error =
      e?.message ||
      "revoke_failed";
  }

  // -------------------- DB clean --------------------

  try {
    const baseMeta =
      buildDisconnectBaseMeta(
        platform,
        acc?.meta
      );

    const nextMeta = {
      ...baseMeta,

      disconnected_at:
        new Date().toISOString(),

      disconnected_by: "user",

      disconnected_platform:
        platform,

      disconnect_revoke:
        revoke,

      previous_status:
        acc?.status ?? null,
    };

    const {
      error: updErr,
    } = await supabaseAdmin
      .from("user_social_accounts")
      .update({
        status: "disconnected",

        // Destroy provider tokens
        access_token_enc: null,
        refresh_token_enc: null,
        token_expires_at: null,

        // Remove provider identity from active row
        account_id: null,
        username: null,

        meta: nextMeta,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", acc.id);

    if (updErr) {
      throw new Error(
        updErr.message
      );
    }
  } catch (e: any) {
    await finishRunError(
      runId,
      "disconnect_db_update_failed",
      {
        platform,
        revoke,
        detail:
          e?.message ||
          "unknown",
      }
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "disconnect_db_update_failed",
        detail:
          e?.message ||
          "unknown",
      },
      {
        status: 500,
      }
    );
  }

  // -------------------- Optional content cleanup --------------------

  if (
    CLEANUP_POSTS_ON_DISCONNECT
  ) {
    try {
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

      await supabaseAdmin
        .from("social_posts")
        .delete()
        .eq(
          "user_id",
          userId
        )
        .eq(
          "platform",
          platform
        );
    } catch (e: any) {
      await finishRunError(
        runId,
        "disconnected_but_cleanup_failed",
        {
          platform,
          revoke,
          cleanup: {
            ok: false,
            error:
              e?.message ||
              "cleanup_failed",
          },
        }
      );

      return NextResponse.json({
        ok: true,
        platform,
        revoked: revoke,

        cleanup: {
          ok: false,
          error:
            e?.message ||
            "cleanup_failed",
        },

        message:
          "Disconnected (cleanup failed — safe to reconnect).",
      });
    }
  }

  // -------------------- Finish run --------------------

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
              ok: true,
            }
          : {
              skipped: true,
            },

      linkedinMetadataCleared:
        platform === "linkedin",
    }
  );

  // -------------------- Response --------------------

  return NextResponse.json({
    ok: true,
    platform,
    alreadyDisconnected,
    revoked: revoke,

    cleanup:
      CLEANUP_POSTS_ON_DISCONNECT
        ? {
            ok: true,
          }
        : {
            skipped: true,
          },

    message:
      revoke.attempted
        ? revoke.ok
          ? "Disconnected + revoke attempted successfully."
          : "Disconnected (revoke failed — token may be expired, safe to reconnect)."
        : "Disconnected.",
  });
}