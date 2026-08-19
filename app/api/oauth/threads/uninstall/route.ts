// app/api/oauth/threads/uninstall/route.ts

import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignedRequestPayload = {
  algorithm?: string;
  user_id?: string | number;
  issued_at?: number;
  expires?: number;
  [key: string]: unknown;
};

type ThreadsAccountRow = {
  id: string;
  user_id: string;
  status: string;
  meta: Record<string, unknown> | null;
};

// -------------------------------------------------------
// Environment
// -------------------------------------------------------

function requireThreadsAppSecret(): string {
  const secret =
    process.env
      .THREADS_APP_SECRET
      ?.trim();

  if (!secret) {
    throw new Error(
      "missing_env:THREADS_APP_SECRET"
    );
  }

  return secret;
}

// -------------------------------------------------------
// signed_request verification
// -------------------------------------------------------

function decodeBase64Url(
  value: string
): Buffer {
  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const paddingLength =
    (
      4 -
      (
        normalized.length %
        4
      )
    ) %
    4;

  return Buffer.from(
    normalized +
      "=".repeat(
        paddingLength
      ),
    "base64"
  );
}

function verifySignedRequest(
  signedRequest: string,
  appSecret: string
): SignedRequestPayload {
  const parts =
    signedRequest.split(
      "."
    );

  if (
    parts.length !==
    2
  ) {
    throw new Error(
      "invalid_signed_request_format"
    );
  }

  const [
    encodedSignature,
    encodedPayload,
  ] = parts;

  if (
    !encodedSignature ||
    !encodedPayload
  ) {
    throw new Error(
      "invalid_signed_request_format"
    );
  }

  let suppliedSignature:
    Buffer;

  let payloadBuffer:
    Buffer;

  try {
    suppliedSignature =
      decodeBase64Url(
        encodedSignature
      );

    payloadBuffer =
      decodeBase64Url(
        encodedPayload
      );
  } catch {
    throw new Error(
      "invalid_signed_request_encoding"
    );
  }

  const expectedSignature =
    createHmac(
      "sha256",
      appSecret
    )
      .update(
        encodedPayload,
        "utf8"
      )
      .digest();

  if (
    suppliedSignature.length !==
    expectedSignature.length
  ) {
    throw new Error(
      "invalid_signed_request_signature"
    );
  }

  if (
    !timingSafeEqual(
      suppliedSignature,
      expectedSignature
    )
  ) {
    throw new Error(
      "invalid_signed_request_signature"
    );
  }

  let payload:
    SignedRequestPayload;

  try {
    payload =
      JSON.parse(
        payloadBuffer.toString(
          "utf8"
        )
      ) as SignedRequestPayload;
  } catch {
    throw new Error(
      "invalid_signed_request_payload"
    );
  }

  const algorithm =
    String(
      payload.algorithm ??
        ""
    )
      .trim()
      .toUpperCase();

  if (
    algorithm !==
    "HMAC-SHA256"
  ) {
    throw new Error(
      "invalid_signed_request_algorithm"
    );
  }

  return payload;
}

async function readSignedRequest(
  req: NextRequest
): Promise<string> {
  const contentType =
    req.headers
      .get(
        "content-type"
      )
      ?.toLowerCase() ??
    "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const body =
      await req
        .json()
        .catch(
          () => ({})
        );

    if (
      typeof body ===
        "object" &&
      body !== null &&
      !Array.isArray(
        body
      )
    ) {
      const value =
        (
          body as Record<
            string,
            unknown
          >
        )
          .signed_request;

      if (
        typeof value ===
          "string" &&
        value.trim()
      ) {
        return value.trim();
      }
    }

    throw new Error(
      "missing_signed_request"
    );
  }

  const formData =
    await req
      .formData()
      .catch(
        () => null
      );

  const value =
    formData?.get(
      "signed_request"
    );

  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      "missing_signed_request"
    );
  }

  return value.trim();
}

function normalizeProviderUserId(
  value: unknown
): string {
  const providerUserId =
    String(
      value ??
        ""
    ).trim();

  if (
    !providerUserId
  ) {
    throw new Error(
      "missing_provider_user_id"
    );
  }

  return providerUserId;
}

// -------------------------------------------------------
// Metadata cleanup
// -------------------------------------------------------

function getMetaObject(
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
    return {
      ...(
        value as Record<
          string,
          unknown
        >
      ),
    };
  }

  return {};
}

function stripActiveThreadsMeta(
  meta: unknown
): Record<
  string,
  unknown
> {
  const next =
    getMetaObject(
      meta
    );

  /*
   * Active OAuth / identity state.
   */
  delete next.last_sync;

  delete next.oauth_connected_at;
  delete next.oauth_flow;

  delete next.threads_user_id;
  delete next.short_token_user_id;

  delete next.username;
  delete next.display_name;

  delete next.profile_picture_url;
  delete next.biography;

  delete next.threads_profile;

  delete next.token;
  delete next.token_type;

  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  delete next.requested_scopes;
  delete next.granted_scopes;

  delete next.publishing_enabled;
  delete next.insights_requested;
  delete next.replies_requested;

  /*
   * Historical analytics such as:
   *
   * threads_synced_post_summary
   * threads_extra_post_metrics
   *
   * are intentionally NOT removed here.
   *
   * Full deletion is handled by:
   *
   * /api/data-deletion/threads
   */

  return next;
}

// -------------------------------------------------------
// Find Threads account
// -------------------------------------------------------

async function findThreadsAccounts(
  threadsUserId: string
): Promise<
  ThreadsAccountRow[]
> {
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
          "status",
          "meta",
        ].join(",")
      )
      .eq(
        "platform",
        "threads"
      )
      .eq(
        "provider",
        "meta"
      )
      .eq(
        "account_id",
        threadsUserId
      );

  if (
    error
  ) {
    throw new Error(
      `threads_deauthorize_lookup_failed:${error.message}`
    );
  }

  return (
  data ??
  []
) as unknown as ThreadsAccountRow[];
}

// -------------------------------------------------------
// Deauthorize account
// -------------------------------------------------------

async function deauthorizeThreadsAccount(
  row: ThreadsAccountRow
): Promise<void> {
  const now =
    new Date()
      .toISOString();

  const cleanMeta =
    stripActiveThreadsMeta(
      row.meta
    );

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .update({
        status:
          "disconnected",

        /*
         * Destroy all locally stored provider
         * credentials immediately.
         */
        access_token_enc:
          null,

        refresh_token_enc:
          null,

        token_expires_at:
          null,

        /*
         * Remove active Threads identity from
         * the connection row.
         *
         * Historical social_posts retain their
         * original account_id so a later Meta
         * data-deletion callback can still map
         * the user if required.
         */
        account_id:
          null,

        username:
          null,

        updated_at:
          now,

        meta: {
          ...cleanMeta,

          deauthorized_at:
            now,

          deauthorized_by:
            "provider",

          deauthorization_source:
            "threads_meta_callback",

          previous_status:
            row.status,
        },
      })
      .eq(
        "id",
        row.id
      );

  if (
    error
  ) {
    throw new Error(
      `threads_deauthorize_update_failed:${error.message}`
    );
  }
}

// -------------------------------------------------------
// Audit run
// -------------------------------------------------------

async function recordDeauthorization(
  userId: string
): Promise<void> {
  const now =
    new Date()
      .toISOString();

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "social_sync_runs"
      )
      .insert({
        user_id:
          userId,

        platform:
          "threads",

        status:
          "ok",

        message:
          "Threads deauthorized by provider",

        started_at:
          now,

        finished_at:
          now,

        meta: {
          event:
            "deauthorization",

          source:
            "threads_meta_callback",
        },
      });

  /*
   * Losing the audit log must never prevent
   * credential destruction.
   */
  if (
    error
  ) {
    console.error(
      "[threads-deauthorize] Audit log failed",
      {
        error:
          error.message,
      }
    );
  }
}

// -------------------------------------------------------
// POST — Meta Deauthorize Callback
// -------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const appSecret =
      requireThreadsAppSecret();

    const signedRequest =
      await readSignedRequest(
        req
      );

    const payload =
      verifySignedRequest(
        signedRequest,
        appSecret
      );

    const threadsUserId =
      normalizeProviderUserId(
        payload.user_id
      );

    const accounts =
      await findThreadsAccounts(
        threadsUserId
      );

    /*
     * Idempotent behavior:
     *
     * If no active mapping exists anymore,
     * we still acknowledge the valid Meta request.
     */
    for (
      const account of
      accounts
    ) {
      await deauthorizeThreadsAccount(
        account
      );

      await recordDeauthorization(
        account.user_id
      );
    }

    /*
     * Never log the raw provider user ID.
     */
    console.info(
      "[threads-deauthorize] Completed",
      {
        matchedAccounts:
          accounts.length,
      }
    );

    return NextResponse.json(
      {
        ok:
          true,
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (
    error
  ) {
    const message =
      error instanceof
      Error
        ? error.message
        : "threads_deauthorization_failed";

    console.error(
      "[threads-deauthorize] Failed",
      {
        error:
          message,
      }
    );

    const badRequest =
      message.startsWith(
        "missing_signed_request"
      ) ||
      message.startsWith(
        "invalid_signed_request"
      ) ||
      message.startsWith(
        "missing_provider_user_id"
      );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          badRequest
            ? "invalid_deauthorization_request"
            : "deauthorization_failed",
      },
      {
        status:
          badRequest
            ? 400
            : 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}