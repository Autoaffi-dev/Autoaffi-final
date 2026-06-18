import { Buffer } from "buffer";
import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  to?: string | string[] | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  replyTo?: string | null;
};

type InboxRow = {
  id: string;
  user_id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  status: string | null;
  is_active: boolean | null;
  send_enabled: boolean | null;
  connected_at: string | null;
};

type TokenRow = {
  id: string;
  inbox_id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  metadata: Record<string, any> | null;
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailSendResponse = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
};

function mustGetEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRecipients(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => normalizeEmail(item))
      .filter((item) => !!item && isValidEmail(item));
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter((item) => !!item && isValidEmail(item));
  }

  return [];
}

function encodeHeader(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return `=?UTF-8?B?${Buffer.from(trimmed, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawMime(input: {
  fromEmail: string;
  fromName?: string | null;
  to: string[];
  subject: string;
  text?: string | null;
  html?: string | null;
  replyTo?: string | null;
}) {
  const lines: string[] = [];
  const encodedSubject = encodeHeader(input.subject);
  const fromName = String(input.fromName ?? "").trim();
  const fromHeader = fromName
    ? `${encodeHeader(fromName)} <${input.fromEmail}>`
    : input.fromEmail;

  lines.push(`From: ${fromHeader}`);
  lines.push(`To: ${input.to.join(", ")}`);
  lines.push(`Subject: ${encodedSubject}`);
  lines.push(`MIME-Version: 1.0`);

  if (input.replyTo?.trim()) {
    lines.push(`Reply-To: ${input.replyTo.trim()}`);
  }

  const text = String(input.text ?? "").replace(/\r\n/g, "\n");
  const html = String(input.html ?? "").trim();

  if (html) {
    const boundary = `autoaffi_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(text || " ");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(html);
    lines.push(`--${boundary}--`);
  } else {
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push(`Content-Transfer-Encoding: 8bit`);
    lines.push("");
    lines.push(text || " ");
  }

  return lines.join("\r\n");
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return false;

  // refresh a bit early
  return ts <= Date.now() + 60_000;
}

async function getActiveInboxForUser(userId: string): Promise<InboxRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("user_connected_inboxes")
    .select(
      "id,user_id,provider,email,display_name,status,is_active,send_enabled,connected_at"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "connected")
    .eq("send_enabled", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`INBOX_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("NO_ACTIVE_CONNECTED_INBOX");
  }

  return data as InboxRow;
}

async function getActiveTokenForInbox(inboxId: string, userId: string): Promise<TokenRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("user_connected_inbox_tokens")
    .select(
      "id,inbox_id,user_id,provider,access_token,refresh_token,token_type,scope,expires_at,is_active,metadata"
    )
    .eq("inbox_id", inboxId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`TOKEN_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id || !data.access_token) {
    throw new Error("NO_ACTIVE_PROVIDER_TOKEN");
  }

  return data as TokenRow;
}

async function refreshGoogleAccessToken(tokenRow: TokenRow): Promise<{
  accessToken: string;
  expiresAt: string | null;
  scope: string | null;
  tokenType: string;
}> {
  if (!tokenRow.refresh_token) {
    throw new Error("MISSING_REFRESH_TOKEN");
  }

  const clientId = mustGetEnv("GOOGLE_CLIENT_ID");
  const clientSecret = mustGetEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });

  const json = (await res.json()) as GoogleRefreshResponse;

  if (!res.ok || !json.access_token) {
    throw new Error(
      `TOKEN_REFRESH_FAILED: ${json.error_description || json.error || `HTTP_${res.status}`}`
    );
  }

  const expiresAt =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("user_connected_inbox_tokens")
    .update({
      access_token: json.access_token,
      token_type: json.token_type ?? "Bearer",
      scope: json.scope ?? tokenRow.scope ?? null,
      expires_at: expiresAt,
      last_refreshed_at: nowIso,
      last_error: null,
    })
    .eq("id", tokenRow.id);

  if (error) {
    throw new Error(`TOKEN_REFRESH_SAVE_FAILED: ${error.message}`);
  }

  return {
    accessToken: json.access_token,
    expiresAt,
    scope: json.scope ?? tokenRow.scope ?? null,
    tokenType: json.token_type ?? "Bearer",
  };
}

async function sendViaGmail(input: {
  accessToken: string;
  rawMime: string;
}): Promise<GmailSendResponse> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: toBase64Url(input.rawMime),
    }),
  });

  const json = (await res.json().catch(() => null)) as GmailSendResponse | null;

  if (!res.ok) {
    const details =
      typeof json === "object" && json !== null ? JSON.stringify(json) : `HTTP_${res.status}`;
    throw new Error(`GMAIL_SEND_FAILED: ${details}`);
  }

  return json ?? {};
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const body = (await req.json().catch(() => ({}))) as SendBody;

    const to = normalizeRecipients(body?.to);
    const subject = String(body?.subject ?? "").trim();
    const text = String(body?.text ?? "").trim();
    const html = String(body?.html ?? "").trim();
    const replyTo = String(body?.replyTo ?? "").trim();

    if (!to.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "TO_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          ok: false,
          error: "SUBJECT_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!text && !html) {
      return NextResponse.json(
        {
          ok: false,
          error: "BODY_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (replyTo && !isValidEmail(replyTo)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_REPLY_TO",
        },
        { status: 400 }
      );
    }

    const inbox = await getActiveInboxForUser(userId);

    if (inbox.provider !== "gmail") {
      return NextResponse.json(
        {
          ok: false,
          error: "PROVIDER_NOT_SUPPORTED_YET",
          details: "Only Gmail sending is active right now.",
        },
        { status: 400 }
      );
    }

    if (!inbox.email || !isValidEmail(inbox.email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONNECTED_INBOX_EMAIL_INVALID",
        },
        { status: 400 }
      );
    }

    const tokenRow = await getActiveTokenForInbox(inbox.id, userId);

    let accessToken = tokenRow.access_token;

    if (isExpired(tokenRow.expires_at)) {
      const refreshed = await refreshGoogleAccessToken(tokenRow);
      accessToken = refreshed.accessToken;
    }

    const rawMime = buildRawMime({
      fromEmail: inbox.email,
      fromName: inbox.display_name,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || undefined,
    });

    let sendResult: GmailSendResponse | null = null;

    try {
      sendResult = await sendViaGmail({
        accessToken,
        rawMime,
      });
    } catch (err: any) {
      const message = String(err?.message ?? "");

      // one retry after refresh if token was stale/revoked-ish
      if (
        tokenRow.refresh_token &&
        (message.includes("401") ||
          message.includes("invalid_grant") ||
          message.includes("Invalid Credentials") ||
          message.includes("GMAIL_SEND_FAILED"))
      ) {
        const refreshed = await refreshGoogleAccessToken(tokenRow);
        accessToken = refreshed.accessToken;

        sendResult = await sendViaGmail({
          accessToken,
          rawMime,
        });
      } else {
        throw err;
      }
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    await supabase
      .from("user_connected_inboxes")
      .update({
        last_send_at: nowIso,
        last_error: null,
      })
      .eq("id", inbox.id);

    await supabase
      .from("user_connected_inbox_tokens")
      .update({
        last_used_at: nowIso,
        last_error: null,
      })
      .eq("id", tokenRow.id);

    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        provider: "gmail",
        inbox: {
          id: inbox.id,
          email: inbox.email,
        },
        sent: {
          to,
          subject,
          providerMessageId: sendResult?.id ?? null,
          providerThreadId: sendResult?.threadId ?? null,
          at: nowIso,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status =
      msg === "UNAUTHORIZED"
        ? 401
        : msg.includes("NO_ACTIVE_CONNECTED_INBOX") ||
          msg.includes("NO_ACTIVE_PROVIDER_TOKEN")
        ? 400
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status }
    );
  }
}