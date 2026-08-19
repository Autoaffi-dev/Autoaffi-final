// app/api/data-deletion/instagram/route.ts

import {
  createHash,
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
  user_id: string;
  account_id: string | null;
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
// Generic value helpers
// -------------------------------------------------------

function getObject(
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
    return value as Record<
      string,
      unknown
    >;
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

/*
 * The Instagram OAuth callback currently stores several
 * provider identifiers.
 *
 * We deliberately accept all known provider identifiers
 * instead of assuming one of them always equals the
 * signed_request user_id.
 */
function accountMatchesInstagramUser(
  row: InstagramAccountRow,
  providerUserId: string
): boolean {
  const meta =
    getObject(
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

// -------------------------------------------------------
// Confirmation receipt
// -------------------------------------------------------

function createConfirmationCode(
  providerUserId: string,
  appSecret: string
): string {
  const timestamp =
    Math.floor(
      Date.now() /
        1000
    ).toString(
      36
    );

  const userHash =
    createHash(
      "sha256"
    )
      .update(
        providerUserId,
        "utf8"
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        20
      );

  const message =
    [
      "instagram-data-deletion",
      timestamp,
      userHash,
    ].join(
      "."
    );

  const signature =
    createHmac(
      "sha256",
      appSecret
    )
      .update(
        message,
        "utf8"
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        32
      );

  return [
    "idr",
    timestamp,
    userHash,
    signature,
  ].join(
    "_"
  );
}

function isValidConfirmationCode(
  code: string,
  appSecret: string
): boolean {
  const parts =
    code.split(
      "_"
    );

  if (
    parts.length !==
      4 ||
    parts[0] !==
      "idr"
  ) {
    return false;
  }

  const [
    ,
    timestamp,
    userHash,
    suppliedSignature,
  ] = parts;

  if (
    !timestamp ||
    !/^[0-9a-z]+$/i.test(
      timestamp
    ) ||
    !userHash ||
    !/^[0-9a-f]{20}$/i.test(
      userHash
    ) ||
    !suppliedSignature ||
    !/^[0-9a-f]{32}$/i.test(
      suppliedSignature
    )
  ) {
    return false;
  }

  const message =
    [
      "instagram-data-deletion",
      timestamp,
      userHash,
    ].join(
      "."
    );

  const expectedSignature =
    createHmac(
      "sha256",
      appSecret
    )
      .update(
        message,
        "utf8"
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        32
      );

  const suppliedBuffer =
    Buffer.from(
      suppliedSignature,
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
    return false;
  }

  return timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );
}

// -------------------------------------------------------
// Locate Autoaffi user(s)
// -------------------------------------------------------

async function findAutoaffiUserIds(
  providerUserId: string
): Promise<string[]> {
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
          "user_id",
          "account_id",
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
      `instagram_deletion_account_lookup_failed:${error.message}`
    );
  }

  const rows =
    (
      data ??
      []
    ) as unknown as InstagramAccountRow[];

  const userIds =
    new Set<string>();

  for (
    const row of
    rows
  ) {
    if (
      !accountMatchesInstagramUser(
        row,
        providerUserId
      )
    ) {
      continue;
    }

    const userId =
      String(
        row.user_id ??
          ""
      ).trim();

    if (userId) {
      userIds.add(
        userId
      );
    }
  }

  return Array.from(
    userIds
  );
}

// -------------------------------------------------------
// Delete Instagram-derived data
// -------------------------------------------------------

async function deleteInstagramData(
  providerUserId: string
): Promise<{
  matchedUsers: number;
}> {
  const userIds =
    await findAutoaffiUserIds(
      providerUserId
    );

  /*
   * Meta may retry a valid deletion request.
   * No matching row therefore remains a successful,
   * idempotent deletion state.
   */
  if (
    userIds.length ===
    0
  ) {
    return {
      matchedUsers:
        0,
    };
  }

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
        "platform",
        "instagram"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    metricsError
  ) {
    throw new Error(
      `instagram_metrics_delete_failed:${metricsError.message}`
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
        "platform",
        "instagram"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    postsError
  ) {
    throw new Error(
      `instagram_posts_delete_failed:${postsError.message}`
    );
  }

  const {
    error:
      runsError,
  } =
    await supabaseAdmin
      .from(
        "social_sync_runs"
      )
      .delete()
      .eq(
        "platform",
        "instagram"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    runsError
  ) {
    throw new Error(
      `instagram_sync_runs_delete_failed:${runsError.message}`
    );
  }

  /*
   * Delete the connection last.
   *
   * This removes the encrypted provider token together
   * with all remaining Instagram OAuth/profile metadata.
   */
  const {
    error:
      accountError,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .delete()
      .eq(
        "platform",
        "instagram"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    accountError
  ) {
    throw new Error(
      `instagram_account_delete_failed:${accountError.message}`
    );
  }

  return {
    matchedUsers:
      userIds.length,
  };
}

// -------------------------------------------------------
// POST — Instagram Data Deletion Callback
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

    const result =
      await deleteInstagramData(
        providerUserId
      );

    const confirmationCode =
      createConfirmationCode(
        providerUserId,
        appSecret
      );

    const statusUrl =
      new URL(
        "/api/data-deletion/instagram",
        req.url
      );

    statusUrl.searchParams.set(
      "code",
      confirmationCode
    );

    /*
     * Never log raw Instagram provider user IDs.
     */
    console.info(
      "[instagram-data-deletion] Completed",
      {
        matchedUsers:
          result.matchedUsers,

        confirmation:
          confirmationCode.slice(
            0,
            12
          ),
      }
    );

    return NextResponse.json(
      {
        url:
          statusUrl.toString(),

        confirmation_code:
          confirmationCode,
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
        : "instagram_data_deletion_failed";

    console.error(
      "[instagram-data-deletion] Failed",
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
            ? "invalid_deletion_request"
            : "data_deletion_failed",
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

// -------------------------------------------------------
// GET — deletion status
// -------------------------------------------------------

export async function GET(
  req: NextRequest
): Promise<Response> {
  let appSecret:
    string;

  try {
    appSecret =
      requireInstagramAppSecret();
  } catch {
    return new Response(
      "Service unavailable",
      {
        status:
          503,

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const code =
    new URL(
      req.url
    ).searchParams
      .get(
        "code"
      )
      ?.trim() ??
    "";

  if (
    !code ||
    !isValidConfirmationCode(
      code,
      appSecret
    )
  ) {
    return new Response(
      "Invalid deletion confirmation code.",
      {
        status:
          400,

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autoaffi — Data deletion</title>
</head>
<body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#f5f5f5;margin:0;padding:40px;">
  <main style="max-width:680px;margin:0 auto;">
    <h1 style="margin-bottom:16px;">Data deletion completed</h1>
    <p>
      Autoaffi has completed the Instagram data deletion request associated with this confirmation.
    </p>
    <p style="opacity:.75;margin-top:24px;">
      Confirmation code: ${code}
    </p>
  </main>
</body>
</html>`,
    {
      status:
        200,

      headers: {
        "Content-Type":
          "text/html; charset=utf-8",

        "Cache-Control":
          "no-store",
      },
    }
  );
}