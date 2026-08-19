// app/api/webhooks/tiktok/route.ts

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

type TikTokWebhookPayload = {
  client_key?: string;
  event?: string;
  create_time?: number;
  user_openid?: string;
  content?: string;
};

type TikTokAccountRow = {
  id: string;
  user_id: string;
  status: string;
  meta: Record<string, unknown> | null;
};

type AuthorizationRemovedContent = {
  reason?: number;
};

// -------------------------------------------------------
// Environment
// -------------------------------------------------------

function requireTikTokClientKey(): string {
  const value =
    process.env
      .TIKTOK_CLIENT_ID
      ?.trim();

  if (!value) {
    throw new Error(
      "missing_env:TIKTOK_CLIENT_ID"
    );
  }

  return value;
}

function requireTikTokClientSecret(): string {
  const value =
    process.env
      .TIKTOK_CLIENT_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "missing_env:TIKTOK_CLIENT_SECRET"
    );
  }

  return value;
}

// -------------------------------------------------------
// Signature verification
// -------------------------------------------------------

function parseTikTokSignature(
  headerValue: string
): {
  timestamp: string;
  signature: string;
} {
  const parts =
    headerValue
      .split(",")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);

  let timestamp =
    "";

  let signature =
    "";

  for (
    const part of
    parts
  ) {
    const separatorIndex =
      part.indexOf("=");

    if (
      separatorIndex <=
      0
    ) {
      continue;
    }

    const key =
      part
        .slice(
          0,
          separatorIndex
        )
        .trim();

    const value =
      part
        .slice(
          separatorIndex +
            1
        )
        .trim();

    if (
      key === "t"
    ) {
      timestamp =
        value;
    }

    if (
      key === "s"
    ) {
      signature =
        value;
    }
  }

  if (
    !timestamp ||
    !signature
  ) {
    throw new Error(
      "invalid_tiktok_signature_header"
    );
  }

  if (
    !/^\d+$/.test(
      timestamp
    )
  ) {
    throw new Error(
      "invalid_tiktok_signature_timestamp"
    );
  }

  if (
    !/^[0-9a-f]+$/i.test(
      signature
    )
  ) {
    throw new Error(
      "invalid_tiktok_signature_value"
    );
  }

  return {
    timestamp,
    signature:
      signature.toLowerCase(),
  };
}

function verifyTikTokSignature(
  args: {
    rawBody: string;
    signatureHeader: string;
    clientSecret: string;
  }
): void {
  const {
    timestamp,
    signature,
  } =
    parseTikTokSignature(
      args.signatureHeader
    );

  const timestampSeconds =
    Number(
      timestamp
    );

  if (
    !Number.isFinite(
      timestampSeconds
    )
  ) {
    throw new Error(
      "invalid_tiktok_signature_timestamp"
    );
  }

  /*
   * TikTok recommends checking webhook age
   * to reduce replay risk.
   *
   * Autoaffi uses a 5-minute tolerance.
   */
  const nowSeconds =
    Math.floor(
      Date.now() /
        1000
    );

  const ageSeconds =
    Math.abs(
      nowSeconds -
        timestampSeconds
    );

  if (
    ageSeconds >
    5 * 60
  ) {
    throw new Error(
      "expired_tiktok_webhook"
    );
  }

  const signedPayload =
    `${timestamp}.${args.rawBody}`;

  const expectedSignature =
    createHmac(
      "sha256",
      args.clientSecret
    )
      .update(
        signedPayload,
        "utf8"
      )
      .digest(
        "hex"
      );

  const suppliedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    throw new Error(
      "invalid_tiktok_webhook_signature"
    );
  }

  if (
    !timingSafeEqual(
      suppliedBuffer,
      expectedBuffer
    )
  ) {
    throw new Error(
      "invalid_tiktok_webhook_signature"
    );
  }
}

// -------------------------------------------------------
// Payload
// -------------------------------------------------------

function parseWebhookPayload(
  rawBody: string
): TikTokWebhookPayload {
  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        rawBody
      );
  } catch {
    throw new Error(
      "invalid_tiktok_webhook_json"
    );
  }

  if (
    typeof parsed !==
      "object" ||
    parsed === null ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "invalid_tiktok_webhook_payload"
    );
  }

  return parsed as TikTokWebhookPayload;
}

function parseAuthorizationRemovedContent(
  value: unknown
): AuthorizationRemovedContent {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      typeof parsed ===
        "object" &&
      parsed !== null &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed as AuthorizationRemovedContent;
    }
  } catch {
    /*
     * The main webhook is still valid even if
     * optional content cannot be parsed.
     */
  }

  return {};
}

// -------------------------------------------------------
// Metadata cleanup
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

function stripActiveTikTokMeta(
  value: unknown
): Record<string, unknown> {
  const next =
    getMetaObject(
      value
    );

  delete next.last_sync;

  delete next.open_id;
  delete next.union_id;

  delete next.tiktok_profile;

  delete next.token;
  delete next.token_type;

  delete next.token_refreshed_at;
  delete next.token_refresh_provider;
  delete next.token_refresh_note;

  delete next.refresh_token_available;
  delete next.refresh_token_expires_in;
  delete next.refresh_token_expires_at;

  delete next.granted_scopes;

  return next;
}

// -------------------------------------------------------
// Locate TikTok account
// -------------------------------------------------------

async function findTikTokAccounts(
  openId: string
): Promise<TikTokAccountRow[]> {
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
        "tiktok"
      )
      .eq(
        "provider",
        "tiktok"
      )
      .eq(
        "account_id",
        openId
      );

  if (
    error
  ) {
    throw new Error(
      `tiktok_webhook_account_lookup_failed:${error.message}`
    );
  }

  return (
    data ??
    []
  ) as unknown as TikTokAccountRow[];
}

// -------------------------------------------------------
// Disconnect locally
// -------------------------------------------------------

async function disconnectTikTokAccount(
  args: {
    account: TikTokAccountRow;
    reason:
      | number
      | null;
    eventCreatedAt:
      | number
      | null;
  }
): Promise<void> {
  const now =
    new Date()
      .toISOString();

  const cleanMeta =
    stripActiveTikTokMeta(
      args.account.meta
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
         * TikTok says authorization.removed is sent
         * after the provider token has already been
         * revoked.
         *
         * Autoaffi destroys its local encrypted copies.
         */
        access_token_enc:
          null,

        refresh_token_enc:
          null,

        token_expires_at:
          null,

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
            "tiktok_authorization_removed",

          deauthorization_reason:
            args.reason,

          provider_event_created_at:
            args.eventCreatedAt,

          previous_status:
            args.account.status,
        },
      })
      .eq(
        "id",
        args.account.id
      );

  if (
    error
  ) {
    throw new Error(
      `tiktok_webhook_disconnect_failed:${error.message}`
    );
  }
}

// -------------------------------------------------------
// Audit
// -------------------------------------------------------

async function recordTikTokDeauthorization(
  args: {
    userId: string;
    reason:
      | number
      | null;
    eventCreatedAt:
      | number
      | null;
  }
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
          args.userId,

        platform:
          "tiktok",

        status:
          "ok",

        message:
          "TikTok deauthorized by provider",

        started_at:
          now,

        finished_at:
          now,

        meta: {
          event:
            "authorization.removed",

          source:
            "tiktok_webhook",

          reason:
            args.reason,

          provider_event_created_at:
            args.eventCreatedAt,
        },
      });

  /*
   * Losing an audit row must never prevent
   * the actual credentials from being destroyed.
   */
  if (
    error
  ) {
    console.error(
      "[tiktok-webhook] Audit log failed",
      {
        error:
          error.message,
      }
    );
  }
}

// -------------------------------------------------------
// POST
// -------------------------------------------------------

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const clientKey =
      requireTikTokClientKey();

    const clientSecret =
      requireTikTokClientSecret();

    /*
     * IMPORTANT:
     *
     * Signature verification must use the exact
     * raw JSON body before JSON parsing/re-serialization.
     */
    const rawBody =
      await req.text();

    const signatureHeader =
      req.headers.get(
        "TikTok-Signature"
      );

    if (
      !signatureHeader
    ) {
      throw new Error(
        "missing_tiktok_signature"
      );
    }

    verifyTikTokSignature({
      rawBody,
      signatureHeader,
      clientSecret,
    });

    const payload =
      parseWebhookPayload(
        rawBody
      );

    /*
     * Ensure this webhook belongs to Autoaffi's
     * registered TikTok application.
     */
    if (
      !payload.client_key ||
      payload.client_key !==
        clientKey
    ) {
      throw new Error(
        "wrong_tiktok_client_key"
      );
    }

    /*
     * TikTok may deliver other subscribed events to
     * the same callback URL.
     *
     * Autoaffi currently only needs the provider
     * deauthorization lifecycle event here.
     */
    if (
      payload.event !==
      "authorization.removed"
    ) {
      return NextResponse.json(
        {
          ok:
            true,

          ignored:
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
    }

    const openId =
      String(
        payload.user_openid ??
          ""
      ).trim();

    if (
      !openId
    ) {
      throw new Error(
        "missing_tiktok_user_openid"
      );
    }

    const content =
      parseAuthorizationRemovedContent(
        payload.content
      );

    const reason =
      typeof content.reason ===
        "number" &&
      Number.isFinite(
        content.reason
      )
        ? content.reason
        : null;

    const eventCreatedAt =
      typeof payload.create_time ===
        "number" &&
      Number.isFinite(
        payload.create_time
      )
        ? payload.create_time
        : null;

    const accounts =
      await findTikTokAccounts(
        openId
      );

    /*
     * Idempotent:
     *
     * If this event is retried after the account was
     * already disconnected, no matching active account_id
     * may remain. We still acknowledge the valid event.
     */
    for (
      const account of
      accounts
    ) {
      await disconnectTikTokAccount(
        {
          account,
          reason,
          eventCreatedAt,
        }
      );

      await recordTikTokDeauthorization(
        {
          userId:
            account.user_id,

          reason,

          eventCreatedAt,
        }
      );
    }

    /*
     * Never log TikTok user_openid or tokens.
     */
    console.info(
      "[tiktok-webhook] authorization.removed processed",
      {
        matchedAccounts:
          accounts.length,

        reason,
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
        : "tiktok_webhook_failed";

    console.error(
      "[tiktok-webhook] Failed",
      {
        error:
          message,
      }
    );

    const badRequest =
      message.startsWith(
        "missing_tiktok_signature"
      ) ||
      message.startsWith(
        "invalid_tiktok_"
      ) ||
      message.startsWith(
        "expired_tiktok_"
      ) ||
      message.startsWith(
        "wrong_tiktok_client_key"
      ) ||
      message.startsWith(
        "missing_tiktok_user_openid"
      );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          badRequest
            ? "invalid_webhook_request"
            : "webhook_processing_failed",
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