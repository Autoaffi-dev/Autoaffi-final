// app/api/data-deletion/threads/route.ts

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

type UserIdRow = {
  user_id: string;
};

// -------------------------------------------------------
// Helpers
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

  const padded =
    normalized +
    "=".repeat(
      paddingLength
    );

  return Buffer.from(
    padded,
    "base64"
  );
}

/**
 * Meta signed_request format:
 *
 * <base64url-signature>.<base64url-payload>
 *
 * Signature:
 * HMAC-SHA256(encodedPayload, appSecret)
 */
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

  /*
   * Meta normally sends form-urlencoded data.
   *
   * JSON support is also accepted here so the route
   * remains easy to test safely.
   */
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
  const userId =
    String(
      value ??
        ""
    ).trim();

  if (
    !userId
  ) {
    throw new Error(
      "missing_provider_user_id"
    );
  }

  return userId;
}

// -------------------------------------------------------
// Confirmation receipt
// -------------------------------------------------------

/**
 * We do not expose the Threads user ID in the
 * confirmation/status URL.
 *
 * Instead we create:
 *
 * timestamp + one-way user hash + HMAC signature
 *
 * No extra database table is required.
 */
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
      "threads-data-deletion",
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
    "tdr",
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
      "tdr"
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
      "threads-data-deletion",
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
  threadsUserId: string
): Promise<string[]> {
  /*
   * Primary mapping:
   *
   * user_social_accounts.account_id
   */
  const {
    data:
      accountRows,
    error:
      accountsError,
  } =
    await supabaseAdmin
      .from(
        "user_social_accounts"
      )
      .select(
        "user_id"
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
    accountsError
  ) {
    throw new Error(
      `threads_deletion_account_lookup_failed:${accountsError.message}`
    );
  }

  /*
   * Secondary mapping:
   *
   * social_posts.account_id
   *
   * This is important for idempotency. If a Threads
   * connection has already been disconnected and its
   * active account row no longer contains account_id,
   * historical Threads posts can still identify the
   * corresponding Autoaffi user.
   */
  const {
    data:
      postRows,
    error:
      postsError,
  } =
    await supabaseAdmin
      .from(
        "social_posts"
      )
      .select(
        "user_id"
      )
      .eq(
        "platform",
        "threads"
      )
      .eq(
        "account_id",
        threadsUserId
      );

  if (
    postsError
  ) {
    throw new Error(
      `threads_deletion_post_lookup_failed:${postsError.message}`
    );
  }

  const ids =
    new Set<string>();

  for (
    const row of
    (
      accountRows ??
      []
    ) as UserIdRow[]
  ) {
    if (
      row.user_id
    ) {
      ids.add(
        String(
          row.user_id
        )
      );
    }
  }

  for (
    const row of
    (
      postRows ??
      []
    ) as UserIdRow[]
  ) {
    if (
      row.user_id
    ) {
      ids.add(
        String(
          row.user_id
        )
      );
    }
  }

  return Array.from(
    ids
  );
}

// -------------------------------------------------------
// Delete Threads-derived data
// -------------------------------------------------------

async function deleteThreadsData(
  threadsUserId: string
): Promise<{
  matchedUsers: number;
}> {
  const userIds =
    await findAutoaffiUserIds(
      threadsUserId
    );

  /*
   * No match is still a successful deletion state.
   *
   * Meta may retry the request, or the user may already
   * have disconnected/deleted the data earlier.
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

  /*
   * Delete normalized metrics first.
   */
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
        "threads"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    metricsError
  ) {
    throw new Error(
      `threads_metrics_delete_failed:${metricsError.message}`
    );
  }

  /*
   * Then delete normalized Threads posts.
   */
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
        "threads"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    postsError
  ) {
    throw new Error(
      `threads_posts_delete_failed:${postsError.message}`
    );
  }

  /*
   * Remove historical Threads sync records.
   */
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
        "threads"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    runsError
  ) {
    throw new Error(
      `threads_sync_runs_delete_failed:${runsError.message}`
    );
  }

  /*
   * Finally delete the Threads connection itself.
   *
   * This destroys the encrypted access token and all
   * Threads-specific metadata because the entire row
   * disappears.
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
        "threads"
      )
      .in(
        "user_id",
        userIds
      );

  if (
    accountError
  ) {
    throw new Error(
      `threads_account_delete_failed:${accountError.message}`
    );
  }

  return {
    matchedUsers:
      userIds.length,
  };
}

// -------------------------------------------------------
// POST — Meta Data Deletion Callback
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

    const result =
      await deleteThreadsData(
        threadsUserId
      );

    const confirmationCode =
      createConfirmationCode(
        threadsUserId,
        appSecret
      );

    const statusUrl =
      new URL(
        "/api/data-deletion/threads",
        req.url
      );

    statusUrl.searchParams.set(
      "code",
      confirmationCode
    );

    /*
     * Do NOT log the raw Threads user ID.
     */
    console.info(
      "[threads-data-deletion] Completed",
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
        : "threads_data_deletion_failed";

    console.error(
      "[threads-data-deletion] Failed",
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
// GET — deletion status URL
// -------------------------------------------------------

export async function GET(
  req: NextRequest
): Promise<Response> {
  let appSecret:
    string;

  try {
    appSecret =
      requireThreadsAppSecret();
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
      Autoaffi has completed the Threads data deletion request associated with this confirmation.
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