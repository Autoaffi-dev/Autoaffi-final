// app/api/oauth/instagram/route.ts

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
  platform: "instagram";
  issuedAt: number;
  nonce: string;
};

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
  return (
    process.env
      .META_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

function encodeBase64Url(
  value: string
): string {
  return Buffer.from(
    value,
    "utf8"
  ).toString("base64url");
}

function signState(
  encodedPayload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedState(
  userId: string,
  secret: string
): string {
  const payload: OAuthStatePayload = {
    userId,
    platform: "instagram",
    issuedAt: Date.now(),
    nonce: crypto
      .randomBytes(24)
      .toString("base64url"),
  };

  const encodedPayload =
    encodeBase64Url(
      JSON.stringify(payload)
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
  const url = new URL(
    "/login/dashboard/social-accounts",
    req.url
  );

  url.searchParams.set(
    "error",
    error
  );

  url.searchParams.set(
    "platform",
    "instagram"
  );

  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    /*
     * 1. Kontrollera att Autoaffi-användaren
     * faktiskt är inloggad.
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
     * 2. Instagram Login använder sitt
     * egna Instagram App ID.
     *
     * Det är INTE samma sak som att
     * routa genom Facebook Login.
     */
    const instagramClientId =
      getRequiredEnv(
        "INSTAGRAM_CLIENT_ID"
      );

    const redirectUri =
      getRequiredEnv(
        "NEXT_PUBLIC_INSTAGRAM_REDIRECT"
      );

    const stateSecret =
      getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing META_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    /*
     * 3. Skapa signerad state.
     *
     * Samma säkerhetsprincip som vi
     * redan använder för Facebook:
     *
     * userId
     * platform
     * issuedAt
     * random nonce
     * HMAC-signatur
     */
    const state =
      createSignedState(
        String(userId),
        stateSecret
      );

    /*
     * 4. Permissions för den DIREKTA
     * Instagram Login-lösningen.
     *
     * Autoaffi behöver:
     *
     * - läsa Professional account
     * - läsa account insights
     *
     * Vi begär inte Facebook Page-
     * permissions här.
     */
    const scope = [
      "instagram_business_basic",
      "instagram_business_manage_insights",
    ].join(",");

    /*
     * 5. Bygg Instagram Business Login URL.
     *
     * OBS:
     * Detta är instagram.com/oauth/authorize,
     * INTE facebook.com/dialog/oauth.
     */
    const params =
      new URLSearchParams({
        client_id:
          instagramClientId,

        redirect_uri:
          redirectUri,

        response_type:
          "code",

        scope,

        state,

        force_reauth:
          "true",
      });

    const authorizationUrl =
      `https://www.instagram.com/oauth/authorize?${params.toString()}`;

    console.info(
      "[instagram-oauth-start] Starting Instagram Business Login",
      {
        platform:
          "instagram",

        redirectUri,

        scopes:
          scope.split(","),

        usesInstagramLogin:
          true,

        usesFacebookLogin:
          false,
      }
    );

    /*
     * 6. Skicka kunden direkt till
     * Instagram Login.
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
      "[instagram-oauth-start] Failed to start Instagram OAuth flow",
      {
        error: message,
      }
    );

    return createErrorRedirect(
      req,
      "instagram_oauth_start_failed"
    );
  }
}