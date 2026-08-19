// app/api/oauth/instagram/uninstall/route.ts

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

type InstagramAccountRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  status: string;
  meta: Record<string, unknown> | null;
};

// -------------------------------------------------------
// Environment
// -------------------------------------------------------

function requireInstagramAppSecret(): string {
  const secret =
    process.env
      .INSTAGRAM_CLIENT_SECRET
      ?.trim();

  if (!secret) {
    throw new Error(
      "missing_env:INSTAGRAM_CLIENT_SECRET"
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

function normalizeInstagramUserId(
  value: unknown
): string {
  const userId =
    String(
      value ??
        ""
    ).trim();

  if (!userId) {
    throw new Error(
      "missing_instagram_user_id"
    );
  }

  return userId;
}

// -------------------------------------------------------
// Metadata / identity helpers
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

function normalizeId(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(
      value
    ).trim();

  return normalized ||
    null;
}

function accountMatchesInstagramUser(
  row: InstagramAccountRow,
  providerUserId: string
): boolean {
  const meta =
    getMetaObject(
      row.meta
    );

  const candidates = [
    row.account_id,

    normalizeId(
      meta.instagram_id
    ),

    normalizeId(
      meta.instagram_user_id
    ),

    normalizeId(
      meta.short_token_user_id
    ),
  ];

  return candidates.some(
    (candidate) =>
      candidate ===
      providerUserId
  );
}

/*
 * Active OAuth/profile information is removed.
 *
 * Provider identity keys are deliberately retained:
 *
 * instagram_id
 * instagram_user_id
 * short_token_user_id
 *
 * This allows a later valid Meta data-deletion request
 * to identify the correct Autoaffi user even after
 * deauthorization has already removed account_id.
 */
function stripActiveInstagramMeta(
  value: unknown
): Record<string, unknown> {
  const next =
    getMetaObject(
      value
    );

  delete next.last_sync;

  delete next.oauth_connected_at;
  delete next.oauth_flow;

  delete next.graph_api_version;

  delete next.username;
  delete next.account_type;

  delete next.instagram_profile;

  delete next.token;
  delete next.token_type;

  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  delete next.granted_scopes;

  delete next.facebook_page_required;
  delete next.requires_facebook_page;

  return next;
}

// -------------------------------------------------------
// Find Instagram connections
// -------------------------------------------------------

async function findInstagramAccounts(
  providerUserId: string
): Promise<InstagramAccountRow[]> {
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
          "account_id",
          "status",
          "meta",
        ].join(",")
      )
      .eq(
        "platform",
        "instagram"
      )
      .eq(
        "provider",
        "meta"
      );

  if (error) {
    throw new Error(
      `instagram_deauthorize_lookup_failed:${error.message}`
    );
  }

  const rows =
    (
      data ??
      []
    ) as unknown as InstagramAccountRow[];

  return rows.filter(
    (row) =>
      accountMatchesInstagramUser(
        row,
        providerUserId
      )
  );
}

// -------------------------------------------------------
// Disconnect locally
// -------------------------------------------------------

async function deauthorizeInstagramAccount(
  account: InstagramAccountRow
): Promise<void> {
  const now =
    new Date()
      .toISOString();

  const cleanMeta =
    stripActiveInstagramMeta(
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
         * Destroy locally stored credentials immediately.
         */
        access_token_enc:
          null,

        refresh_token_enc:
          null,

        token_expires_at:
          null,

        /*
         * Active account identity disappears.
         *
         * Provider correlation IDs remain inside metadata
         * solely so a later deletion request can map back
         * to this Autoaffi user.
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
            "instagram_meta_callback",

          previous_status:
            account.status,
        },
      })
      .eq(
        "id",
        account.id
      );

  if (error) {
    throw new Error(
      `instagram_deauthorize_update_failed:${error.message}`
    );
  }
}

// -------------------------------------------------------
// Audit
// -------------------------------------------------------

async function recordInstagramDeauthorization(
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
          "instagram",

        status:
          "ok",

        message:
          "Instagram deauthorized by provider",

        started_at:
          now,

        finished_at:
          now,

        meta: {
          event:
            "deauthorization",

          source:
            "instagram_meta_callback",
        },
      });

  /*
   * Audit logging must never prevent credential
   * destruction.
   */
  if (error) {
    console.error(
      "[instagram-deauthorize] Audit log failed",
      {
        error:
          error.message,
      }
    );
  }
}

// -------------------------------------------------------
// POST — Instagram Deauthorize Callback
// -------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const appSecret =
      requireInstagramAppSecret();

    const signedRequest =
      await readSignedRequest(
        req
      );

    const payload =
      verifySignedRequest(
        signedRequest,
        appSecret
      );

    const providerUserId =
      normalizeInstagramUserId(
        payload.user_id
      );

    const accounts =
      await findInstagramAccounts(
        providerUserId
      );

    /*
     * Idempotent:
     *
     * repeated valid callbacks are acknowledged even
     * after the connection has already been disabled.
     */
    for (
      const account of
      accounts
    ) {
      await deauthorizeInstagramAccount(
        account
      );

      await recordInstagramDeauthorization(
        account.user_id
      );
    }

    /*
     * Never log raw Instagram provider IDs or tokens.
     */
    console.info(
      "[instagram-deauthorize] Completed",
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
        : "instagram_deauthorization_failed";

    console.error(
      "[instagram-deauthorize] Failed",
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
        "missing_instagram_user_id"
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