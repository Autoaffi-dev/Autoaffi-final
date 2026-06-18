import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type InboxRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string | null;
  provider_user_id: string | null;
  email: string | null;
  display_name: string | null;
  status: string;
  is_active: boolean;
  metadata: Record<string, any> | null;
};

function mustGetEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function buildSettingsRedirect(baseUrl: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/login/dashboard/settings/email`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);

    const code = url.searchParams.get("code")?.trim() ?? "";
    const state = url.searchParams.get("state")?.trim() ?? "";
    const oauthError = url.searchParams.get("error")?.trim() ?? "";

    if (oauthError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "GOOGLE_OAUTH_DENIED",
          details: oauthError,
        })
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "MISSING_CODE_OR_STATE",
        })
      );
    }

    const googleClientId = mustGetEnv("GOOGLE_CLIENT_ID");
    const googleClientSecret = mustGetEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = `${baseUrl}/api/business/email/callback`;

    // 1) Find the pending Gmail inbox row that owns this oauth_state
    const { data: pendingRows, error: pendingError } = await supabase
      .from("user_connected_inboxes")
      .select(
        "id,user_id,provider,provider_account_id,provider_user_id,email,display_name,status,is_active,metadata"
      )
      .eq("provider", "gmail")
      .eq("status", "pending")
      .contains("metadata", { oauth_state: state });

    if (pendingError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "PENDING_INBOX_LOOKUP_FAILED",
          details: pendingError.message,
        })
      );
    }

    const inbox = ((pendingRows ?? [])[0] ?? null) as InboxRow | null;

    if (!inbox?.id || !inbox.user_id) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "STATE_NOT_FOUND",
        })
      );
    }

    // 2) Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "TOKEN_EXCHANGE_FAILED",
          details:
            tokenJson.error_description ||
            tokenJson.error ||
            `HTTP_${tokenRes.status}`,
        })
      );
    }

    // 3) Load Google user info
    const userInfoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
        },
      }
    );

    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;

    if (!userInfoRes.ok || !userInfo.email || !userInfo.sub) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "GOOGLE_USERINFO_FAILED",
        })
      );
    }

    const providerEmail = normalizeEmail(userInfo.email);
    const providerUserId = String(userInfo.sub);
    const displayName =
      String(userInfo.name ?? "").trim() ||
      String(userInfo.given_name ?? "").trim() ||
      providerEmail;

    const nowIso = new Date().toISOString();
    const expiresAt =
      typeof tokenJson.expires_in === "number" && Number.isFinite(tokenJson.expires_in)
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : null;

    // 4) Deactivate any currently active inbox rows for this user
    const { error: deactivateInboxError } = await supabase
      .from("user_connected_inboxes")
      .update({
        is_active: false,
        status: "disconnected",
        disconnected_at: nowIso,
      })
      .eq("user_id", inbox.user_id)
      .eq("is_active", true);

    if (deactivateInboxError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "INBOX_DEACTIVATE_FAILED",
          details: deactivateInboxError.message,
        })
      );
    }

    // 5) Activate/update Gmail inbox row
    const { error: inboxUpdateError } = await supabase
      .from("user_connected_inboxes")
      .update({
        provider: "gmail",
        provider_account_id: providerEmail,
        provider_user_id: providerUserId,
        email: providerEmail,
        display_name: displayName,
        status: "connected",
        is_active: true,
        send_enabled: true,
        sync_replies_enabled: true,
        scopes: tokenJson.scope
          ? tokenJson.scope.split(" ").map((s) => s.trim()).filter(Boolean)
          : [],
        connected_at: nowIso,
        last_verified_at: nowIso,
        disconnected_at: null,
        last_error: null,
        metadata: {
          ...(inbox.metadata ?? {}),
          oauth_state: null,
          oauth_completed_at: nowIso,
          oauth_redirect_uri: redirectUri,
          email_verified: userInfo.email_verified === true,
          picture: userInfo.picture ?? null,
        },
      })
      .eq("id", inbox.id);

    if (inboxUpdateError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "INBOX_UPDATE_FAILED",
          details: inboxUpdateError.message,
        })
      );
    }

    // 6) Deactivate any active token row for this inbox
    const { error: deactivateTokenError } = await supabase
      .from("user_connected_inbox_tokens")
      .update({
        is_active: false,
      })
      .eq("inbox_id", inbox.id)
      .eq("is_active", true);

    if (deactivateTokenError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "TOKEN_DEACTIVATE_FAILED",
          details: deactivateTokenError.message,
        })
      );
    }

    // 7) Insert fresh active token row
    const { error: tokenInsertError } = await supabase
      .from("user_connected_inbox_tokens")
      .insert({
        inbox_id: inbox.id,
        user_id: inbox.user_id,
        provider: "gmail",
        provider_account_id: providerEmail,
        provider_user_id: providerUserId,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? null,
        token_type: tokenJson.token_type ?? "Bearer",
        scope: tokenJson.scope ?? null,
        expires_at: expiresAt,
        last_refreshed_at: nowIso,
        last_used_at: null,
        is_active: true,
        last_error: null,
        metadata: {
          id_token_present: !!tokenJson.id_token,
        },
      });

    if (tokenInsertError) {
      return NextResponse.redirect(
        buildSettingsRedirect(baseUrl, {
          error: "TOKEN_INSERT_FAILED",
          details: tokenInsertError.message,
        })
      );
    }

    return NextResponse.redirect(
      buildSettingsRedirect(baseUrl, {
        success: "gmail_connected",
      })
    );
  } catch (err: any) {
    return NextResponse.redirect(
      buildSettingsRedirect(baseUrl, {
        error: "CALLBACK_FAILED",
        details: err?.message ?? "Unknown error",
      })
    );
  }
}