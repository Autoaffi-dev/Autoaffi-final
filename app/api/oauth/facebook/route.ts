// app/api/oauth/facebook/route.ts
import crypto from "node:crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaPlatform =
  | "facebook"
  | "instagram";

type OAuthStatePayload = {
  userId: string;
  platform: MetaPlatform;
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

function getGraphApiVersion(): string {
  const configuredVersion =
    process.env
      .META_GRAPH_API_VERSION
      ?.trim() || "v26.0";

  return configuredVersion.startsWith(
    "v"
  )
    ? configuredVersion
    : `v${configuredVersion}`;
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
  platform: MetaPlatform,
  secret: string
): string {
  const payload: OAuthStatePayload = {
    userId,
    platform,
    issuedAt: Date.now(),
    nonce: crypto
      .randomBytes(24)
      .toString("base64url"),
  };

  const encodedPayload =
    encodeBase64Url(
      JSON.stringify(payload)
    );

  const signature = signState(
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

  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    const userId =
      session?.user?.id;

    if (!userId) {
      const loginUrl = new URL(
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

    const platformParam = (
      req.nextUrl.searchParams.get(
        "platform"
      ) || "facebook"
    )
      .toLowerCase()
      .trim();

    const platform: MetaPlatform =
      platformParam === "instagram"
        ? "instagram"
        : "facebook";

    const clientId =
      getRequiredEnv(
        "FACEBOOK_CLIENT_ID"
      );

    const redirectUri =
      getRequiredEnv(
        "NEXT_PUBLIC_FACEBOOK_REDIRECT"
      );

    const configurationId =
      getRequiredEnv(
        "META_LOGIN_CONFIGURATION_ID"
      );

    const stateSecret =
      getStateSecret();

    if (!stateSecret) {
      throw new Error(
        "Missing META_OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
      );
    }

    const graphApiVersion =
      getGraphApiVersion();

    const state =
      createSignedState(
        String(userId),
        platform,
        stateSecret
      );

    /*
     * Facebook Login for Business.
     *
     * Behörigheterna styrs av Login Configuration
     * i Meta Developer Dashboard.
     *
     * Vi skickar därför config_id och ingen
     * separat scope-parameter.
     */
    const params =
      new URLSearchParams({
        client_id: clientId,
        redirect_uri:
          redirectUri,
        response_type: "code",
        config_id:
          configurationId,
        state,
        auth_type:
          "rerequest",
      });

    const authorizationUrl =
      `https://www.facebook.com/${graphApiVersion}/dialog/oauth?` +
      params.toString();

    console.info(
      "[meta-oauth-start] Starting Facebook Login for Business",
      {
        platform,
        graphApiVersion,
        redirectUri,
        configurationId,
        usesConfigurationId:
          true,
      }
    );

    return NextResponse.redirect(
      authorizationUrl
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      "[meta-oauth-start] Failed to start OAuth flow",
      {
        error: message,
      }
    );

    return createErrorRedirect(
      req,
      "meta_oauth_start_failed"
    );
  }
}