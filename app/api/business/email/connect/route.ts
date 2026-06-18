import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectBody = {
  provider?: string | null;
};

function normalizeProvider(value: unknown): "gmail" | "outlook" | "other" {
  const provider = String(value ?? "").trim().toLowerCase();

  if (provider.includes("gmail") || provider.includes("google")) {
    return "gmail";
  }

  if (
    provider.includes("outlook") ||
    provider.includes("microsoft") ||
    provider.includes("office365") ||
    provider.includes("office_365")
  ) {
    return "outlook";
  }

  return "other";
}

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

function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getSupabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as ConnectBody;

    const provider = normalizeProvider(body?.provider);

    if (provider !== "gmail") {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "PROVIDER_NOT_SUPPORTED_YET",
          details: "Only Gmail is enabled right now. Outlook can be added later on the same architecture.",
        },
        { status: 400 }
      );
    }

    const googleClientId = mustGetEnv("GOOGLE_CLIENT_ID");
    mustGetEnv("GOOGLE_CLIENT_SECRET");

    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/business/email/callback`;

    const state = randomBytes(24).toString("hex");
    const nowIso = new Date().toISOString();

    const { error: stateInsertError } = await supabase
      .from("user_connected_inboxes")
      .upsert(
        {
          user_id: userId,
          provider: "gmail",
          status: "pending",
          is_active: false,
          send_enabled: false,
          sync_replies_enabled: false,
          metadata: {
            oauth_state: state,
            oauth_started_at: nowIso,
            oauth_redirect_uri: redirectUri,
          },
          updated_at: nowIso,
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (stateInsertError) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "OAUTH_STATE_SAVE_FAILED",
          details: stateInsertError.message,
        },
        { status: 500 }
      );
    }

    const redirectUrl = buildGoogleAuthUrl({
      clientId: googleClientId,
      redirectUri,
      state,
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        connected: false,
        provider: "gmail",
        redirectUrl,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status =
      msg === "UNAUTHORIZED" ? 401 : msg.startsWith("Missing env:") ? 500 : 400;

    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: msg,
      },
      { status }
    );
  }
}