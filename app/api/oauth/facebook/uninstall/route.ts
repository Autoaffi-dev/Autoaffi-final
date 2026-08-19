// app/api/oauth/facebook/uninstall/route.ts

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

type FacebookAccountRow = {
  id: string;
  user_id: string;
  status: string;
  meta: Record<string, unknown> | null;
};

// -------------------------------------------------------
// Environment
// -------------------------------------------------------

function requireFacebookAppSecret(): string {
  const secret =
    process.env
      .FACEBOOK_CLIENT_SECRET
      ?.trim();

  if (!secret) {
    throw new Error(
      "missing_env:FACEBOOK_CLIENT_SECRET"
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
        ).signed_request;

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

function normalizeMetaUserId(
  value: unknown
): string {
  const metaUserId =
    String(
      value ??
        ""
    ).trim();

  if (!metaUserId) {
    throw new Error(
      "missing_meta_user_id"
    );
  }

  return metaUserId;
}

// -------------------------------------------------------
// Metadata helpers
// -------------------------------------------------------

function getMetaObject(
  value: unknown
): Record<string, unknown> {
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

/*
 * Remove active Facebook OAuth state while preserving:
 *
 * meta_user_id
 *
 * This is deliberate.
 *
 * If Meta later sends a Data Deletion Request,
 * /api/data-deletion/facebook still needs a safe
 * provider identity → Autoaffi user mapping.
 */
function stripActiveFacebookMeta(
  meta: unknown
): Record<string, unknown> {
  const next =
    getMetaObject(
      meta
    );

  delete next.last_sync;

  delete next.oauth_connected_at;

  delete next.graph_api_version;

  delete next.token_type;
  delete next.token_response_type;

  delete next.token_app_id;
  delete next.token_application;

  delete next.is_system_user_token;
  delete next.used_long_lived_exchange;

  delete next.debug_token_scopes;
  delete next.granular_scopes;

  delete next.granted_scopes;
  delete next.declined_scopes;
  delete next.expired_scopes;

  delete next.data_access_expires_at;
  delete next.token_expires_at;

  delete next.graph_diagnostic;

  delete next.token;
  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  /*
   * Keep:
   *
   * meta_user_id
   * assigned_pages
   * assigned_page_ids
   * assigned_instagram_ids
   *
   * Historical performance is intentionally retained
   * until an actual data-deletion request is received.
   */

  return next;
}

// -------------------------------------------------------
// Locate Facebook connections
// -------------------------------------------------------

async function queryFacebookAccountsByMeta(
  metaFragment: Record<
    string,
    unknown
  >
): Promise<FacebookAccountRow[]> {
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
        "facebook"
      )
      .eq(
        "provider",
        "meta"
      )
      .contains(
        "meta",
        metaFragment
      );

  if (
    error
  ) {
    throw new Error(
      `facebook_deauthorize_lookup_failed:${error.message}`
    );
  }

  return (
    data ??
    []
  ) as unknown as FacebookAccountRow[];
}

async function findFacebookAccounts(
  metaUserId: string
): Promise<FacebookAccountRow[]> {
  /*
   * Primary mapping.
   *
   * Written by:
   *
   * app/api/oauth/facebook/callback/route.ts
   */
  const primaryRows =
    await queryFacebookAccountsByMeta(
      {
        meta_user_id:
          metaUserId,
      }
    );

  /*
   * Compatibility fallback for older rows where
   * the Graph /me identifier may exist inside
   * graph_diagnostic.
   */
  const fallbackRows =
    await queryFacebookAccountsByMeta(
      {
        graph_diagnostic: {
          me_id:
            metaUserId,
        },
      }
    );

  const deduped =
    new Map<
      string,
      FacebookAccountRow
    >();

  for (
    const row of
    [
      ...primaryRows,
      ...fallbackRows,
    ]
  ) {
    deduped.set(
      row.id,
      row
    );
  }

  return Array.from(
    deduped.values()
  );
}

// -------------------------------------------------------
// Disconnect Facebook locally
// -------------------------------------------------------

async function deauthorizeFacebookAccount(
  account: FacebookAccountRow
): Promise<void> {
  const now =
    new Date()
      .toISOString();

  const cleanMeta =
    stripActiveFacebookMeta(
      account.meta
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
         * Destroy all active provider credentials.
         */
        access_token_enc:
          null,

        refresh_token_enc:
          null,

        token_expires_at:
          null,

        /*
         * account_id is Autoaffi's active Facebook Page
         * identity, not Meta's signed_request user_id.
         *
         * Remove it from the active connection row.
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
            "facebook_meta_callback",

          previous_status:
            account.status,
        },
      })
      .eq(
        "id",
        account.id
      );

  if (
    error
  ) {
    throw new Error(
      `facebook_deauthorize_update_failed:${error.message}`
    );
  }
}

// -------------------------------------------------------
// Audit
// -------------------------------------------------------

async function recordFacebookDeauthorization(
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
          "facebook",

        status:
          "ok",

        message:
          "Facebook deauthorized by provider",

        started_at:
          now,

        finished_at:
          now,

        meta: {
          event:
            "deauthorization",

          source:
            "facebook_meta_callback",
        },
      });

  /*
   * Audit failure must never prevent
   * credential destruction.
   */
  if (
    error
  ) {
    console.error(
      "[facebook-deauthorize] Audit log failed",
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
      requireFacebookAppSecret();

    const signedRequest =
      await readSignedRequest(
        req
      );

    const payload =
      verifySignedRequest(
        signedRequest,
        appSecret
      );

    const metaUserId =
      normalizeMetaUserId(
        payload.user_id
      );

    const accounts =
      await findFacebookAccounts(
        metaUserId
      );

    /*
     * Idempotent:
     *
     * Meta may retry a valid callback after the
     * connection has already been removed.
     */
    for (
      const account of
      accounts
    ) {
      await deauthorizeFacebookAccount(
        account
      );

      await recordFacebookDeauthorization(
        account.user_id
      );
    }

    /*
     * Never log raw Meta user IDs or tokens.
     */
    console.info(
      "[facebook-deauthorize] Completed",
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
        : "facebook_deauthorization_failed";

    console.error(
      "[facebook-deauthorize] Failed",
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
        "missing_meta_user_id"
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