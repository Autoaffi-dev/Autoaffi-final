// app/api/oauth/google/route.ts

import crypto from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleOAuthStatePayload = {
  userId: string;
  platform: "youtube";
  issuedAt: number;
  nonce: string;
};

const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getStateSecret(): string {
  return (
    process.env
      .GOOGLE_OAUTH_STATE_SECRET
      ?.trim() ||
    process.env
      .NEXTAUTH_SECRET
      ?.trim() ||
    ""
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
      encodedPayload,
      "utf8"
    )
    .digest(
      "base64url"
    );
}

function createSignedState(
  payload: GoogleOAuthStatePayload,
  secret: string
): string {
  const encodedPayload =
    Buffer.from(
      JSON.stringify(
        payload
      ),
      "utf8"
    ).toString(
      "base64url"
    );

  const signature =
    signState(
      encodedPayload,
      secret
    );

  return `${encodedPayload}.${signature}`;
}

// -------------------------------------------------------
// GET — Start Google / YouTube OAuth
// -------------------------------------------------------

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  const session =
    await getServerSession(
      authOptions
    );

  const rawUserId =
    session?.user?.id;

  if (!rawUserId) {
    return NextResponse.redirect(
      new URL(
        "/login?error=unauthorized",
        req.url
      )
    );
  }

  const userId =
    String(
      rawUserId
    );

  if (
    !isUuid(
      userId
    )
  ) {
    return NextResponse.redirect(
      new URL(
        "/login/dashboard/social-accounts?error=bad_session_userid&platform=youtube",
        req.url
      )
    );
  }

  /*
   * This Google OAuth route belongs specifically to
   * Autoaffi's YouTube social integration.
   *
   * Do not silently allow another platform name and
   * later store it as YouTube.
   */
  const requestedPlatform =
    req.nextUrl.searchParams
      .get(
        "platform"
      )
      ?.trim()
      .toLowerCase();

  if (
    requestedPlatform &&
    requestedPlatform !==
      "youtube"
  ) {
    return NextResponse.redirect(
      new URL(
        "/login/dashboard/social-accounts?error=invalid_google_platform&platform=youtube",
        req.url
      )
    );
  }

  const clientId =
    process.env
      .GOOGLE_CLIENT_ID
      ?.trim();

  if (!clientId) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          "Missing GOOGLE_CLIENT_ID",
      },
      {
        status:
          500,
      }
    );
  }

  const stateSecret =
    getStateSecret();

  if (!stateSecret) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          "Missing GOOGLE_OAUTH_STATE_SECRET or NEXTAUTH_SECRET",
      },
      {
        status:
          500,
      }
    );
  }

  /*
   * Keep the same redirect URI construction used by the
   * existing working Autoaffi Google integration.
   *
   * This must exactly match Google Cloud Console.
   */
  const origin =
    req.nextUrl.origin;

  const redirectUri =
    new URL(
      "/api/oauth/google/callback",
      origin
    ).toString();

  const state =
    createSignedState(
      {
        userId,

        platform:
          "youtube",

        issuedAt:
          Date.now(),

        nonce:
          crypto
            .randomBytes(
              24
            )
            .toString(
              "base64url"
            ),
      },
      stateSecret
    );

  /*
   * Autoaffi currently only needs read access to the
   * connected YouTube account.
   *
   * Do not request unrelated Google profile/email scopes.
   */
  const params =
    new URLSearchParams({
      client_id:
        clientId,

      redirect_uri:
        redirectUri,

      response_type:
        "code",

      scope:
        YOUTUBE_READONLY_SCOPE,

      access_type:
        "offline",

      prompt:
        "consent",

      include_granted_scopes:
        "true",

      state,
    });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}