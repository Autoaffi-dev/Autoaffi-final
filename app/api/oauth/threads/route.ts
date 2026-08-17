// app/api/oauth/threads/route.ts

import crypto from "node:crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OAuthStatePayload = {
  userId: string;
  platform: "threads";
  issuedAt: number;
  nonce: string;
};

/*
 * -------------------------------------------------------
 * Helpers
 * -------------------------------------------------------
 */

function getRequiredEnv(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function getStateSecret(): string {
  /*
   * Threads ligger i Meta-familjen och använder
   * samma signerade state-princip som Instagram/Facebook.
   *
   * Vi återanvänder därför befintlig
   * META_OAUTH_STATE_SECRET.
   *
   * NEXTAUTH_SECRET fungerar som befintlig fallback.
   */
  return (
    process.env
      .META_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env
      .NEXTAUTH_SECRET
      ?.trim() ||
    ""
  );
}

function getRedirectUri(): string {
  /*
   * Autoaffi har både:
   *
   * THREADS_REDIRECT_URI
   * NEXT_PUBLIC_THREADS_REDIRECT
   *
   * Redirect URI är inte en hemlighet.
   *
   * Servervariabeln prioriteras, men vi behåller
   * NEXT_PUBLIC-variabeln som kompatibel fallback
   * eftersom övriga sociala integrationer redan
   * använder motsvarande struktur.
   */
  return (
    process.env
      .THREADS_REDIRECT_URI
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_THREADS_REDIRECT
      ?.trim() ||
    ""
  );
}

function encodeBase64Url(
  value: string
): string {
  return Buffer.from(
    value,
    "utf8"
  ).toString(
    "base64url"
  );
}

function signState(
  encodedPayload: string,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      encodedPayload
    )
    .digest(
      "base64url"
    );
}

function createSignedState(
  userId: string,
  secret: string
): string {
  const payload: OAuthStatePayload = {
    userId,
    platform:
      "threads",
    issuedAt:
      Date.now(),
    nonce:
      crypto
        .randomBytes(24)
        .toString(
          "base64url"
        ),
  };

  const encodedPayload =
    encodeBase64Url(
      JSON.stringify(
        payload
      )
    );

  const signature =
    signState(
      encodedPayload,
      secret
    );

  return `${encodedPayload}.${signature}`;
}

function createErrorRedirect(
  req: NextRequest,
  error: string
): NextResponse {
  const url =
    new URL(
      "/login/dashboard/social-accounts",
      req.url
    );

  url.searchParams.set(
    "error",
    error
  );

  url.searchParams.set(
    "platform",
    "threads"
  );

  return NextResponse.redirect(
    url
  );
}

/*
 * -------------------------------------------------------
 * GET — START THREADS OAUTH
 * -------------------------------------------------------
 */

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    /*
     * ---------------------------------------------------
     * 1. Verify logged-in Autoaffi user
     * ---------------------------------------------------
     *
     * OAuth får aldrig startas för ett godtyckligt
     * userId från query/body.
     *
     * Den aktuella NextAuth-sessionen är source of truth.
     */

    const session =
      await getServerSession(
        authOptions
      );

    const userId =
      session?.user?.id;

    if (!userId) {
      const loginUrl =
        new URL(
          "/login",
          req.url
        );

      loginUrl.searchParams.set(
        "error",
        "unauthorized"
      );

      return NextResponse.redirect(
        loginUrl
      );
    }

    /*
     * ---------------------------------------------------
     * 2. Threads configuration
     * ---------------------------------------------------
     *
     * Threads använder sitt eget Threads App ID.
     *
     * THREADS_APP_SECRET används INTE i denna route.
     * Secret behövs först server-side i callbacken
     * när authorization code ska växlas mot token.
     */

    const threadsAppId =
      getRequiredEnv(
        "THREADS_APP_ID"
      );

    const redirectUri =
      getRedirectUri();

    if (!redirectUri) {
      throw new Error(
        "Missing THREADS_REDIRECT_URI or NEXT_PUBLIC_THREADS_REDIRECT"
      );
    }

    const stateSecret =
      getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing META_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    /*
     * ---------------------------------------------------
     * 3. Create signed OAuth state
     * ---------------------------------------------------
     *
     * State binds the callback to:
     *
     * - current Autoaffi user
     * - Threads platform
     * - issued timestamp
     * - cryptographically random nonce
     *
     * Callbacken verifierar både signaturen och
     * att samma Autoaffi-user fortfarande är inloggad.
     */

    const state =
      createSignedState(
        String(userId),
        stateSecret
      );

    /*
     * ---------------------------------------------------
     * 4. Threads permissions
     * ---------------------------------------------------
     *
     * Autoaffi behöver vid launch:
     *
     * threads_basic
     *   - grundläggande Threads-identitet/API-access
     *
     * threads_manage_insights
     *   - performance/insights till Growth Hub
     *
     * threads_read_replies
     *   - läsa replies där Threads API tillåter det
     *
     * Vi begär INTE:
     *
     * threads_content_publish
     *
     * eftersom direktpublicering inte ingår i
     * nuvarande launch-scope.
     */

    const scope = [
      "threads_basic",
      "threads_manage_insights",
      "threads_read_replies",
    ].join(",");

    /*
     * ---------------------------------------------------
     * 5. Build Threads authorization URL
     * ---------------------------------------------------
     *
     * Redirect URI måste matcha exakt den URI
     * som registrerats i Meta Threads Settings:
     *
     * https://autoaffi-final.vercel.app/api/oauth/threads/callback
     */

    const params =
      new URLSearchParams({
        client_id:
          threadsAppId,

        redirect_uri:
          redirectUri,

        scope,

        response_type:
          "code",

        state,
      });

    const authorizationUrl =
      `https://threads.com/oauth/authorize?${params.toString()}`;

    /*
     * ---------------------------------------------------
     * 6. Safe diagnostics
     * ---------------------------------------------------
     *
     * Vi loggar aldrig:
     *
     * - state
     * - access tokens
     * - app secret
     */

    console.info(
      "[threads-oauth-start] Starting Threads OAuth",
      {
        platform:
          "threads",

        redirectUri,

        scopes:
          scope.split(","),

        provider:
          "meta",

        publishingRequested:
          false,
      }
    );

    /*
     * ---------------------------------------------------
     * 7. Redirect user to Threads authorization
     * ---------------------------------------------------
     */

    return NextResponse.redirect(
      authorizationUrl
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[threads-oauth-start] Failed to start Threads OAuth flow",
      {
        platform:
          "threads",

        error:
          message,
      }
    );

    return createErrorRedirect(
      req,
      "threads_oauth_start_failed"
    );
  }
}