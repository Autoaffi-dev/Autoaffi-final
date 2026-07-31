import { Buffer } from "buffer";
import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendContactManagerEmailBody = {
  contactId?: string | null;
  subject?: string | null;
  message?: string | null;
  replyTo?: string | null;
};

type ContactManagerItemRow = {
  id: string;
  user_id: string;
  source_type: string | null;
  source_label: string | null;
  name: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  status: string | null;
  temperature: string | null;
  notes: string | null;
  suggested_opener: string | null;
  next_step: string | null;
  is_archived: boolean | null;
  do_not_contact: boolean | null;
  do_not_contact_reason: string | null;
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

function sanitizeHeaderId(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;

  const cleaned = sanitizeHeaderId(String(value));

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    cleaned
  );
}

async function getEffectiveUserId(req: Request) {
  try {
    return await requireUserId(req);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UNAUTHORIZED");
    }

    const headerUserId = sanitizeHeaderId(
      req.headers.get("x-autoaffi-user-id") || ""
    );

    const devUserId = sanitizeHeaderId(
      (process.env.NEXT_PUBLIC_DEV_USER_ID || "").trim() ||
        (process.env.DEV_USER_ID || "").trim() ||
        (process.env.AUTOAFFI_DEV_USER_ID || "").trim()
    );

    if (isUuid(headerUserId)) return headerUserId;
    if (isUuid(devUserId)) return devUserId;

    throw new Error("UNAUTHORIZED");
  }
}

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

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;

  const ts = new Date(expiresAt).getTime();

  if (!Number.isFinite(ts)) return false;

  return ts <= Date.now() + 60_000;
}

function buildSubject(item: ContactManagerItemRow, rawSubject?: string | null) {
  const clean = String(rawSubject || "").trim();

  if (clean) return clean;

  if (item.source_type === "business-finder") {
    return "Quick question";
  }

  if (item.source_type === "gpt-store") {
    return "Autoaffi follow-up";
  }

  if (item.source_type === "qr-leads") {
    return "Thanks for your interest";
  }

  return "Quick Autoaffi question";
}

function buildRawMime(input: {
  fromEmail: string;
  fromName?: string | null;
  to: string[];
  subject: string;
  text: string;
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

  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push(`Content-Transfer-Encoding: 8bit`);
  lines.push("");
  lines.push(String(input.text || " ").replace(/\r\n/g, "\n"));

  return lines.join("\r\n");
}

async function getContactManagerItem(userId: string, contactId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("contact_manager_items")
    .select(
      `
      id,
      user_id,
      source_type,
      source_label,
      name,
      title,
      description,
      email,
      status,
      temperature,
      notes,
      suggested_opener,
      next_step,
      is_archived,
      do_not_contact,
      do_not_contact_reason
    `
    )
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`CONTACT_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("CONTACT_NOT_FOUND");
  }

  return data as ContactManagerItemRow;
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

async function getActiveTokenForInbox(
  inboxId: string,
  userId: string
): Promise<TokenRow> {
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
      `TOKEN_REFRESH_FAILED: ${
        json.error_description || json.error || `HTTP_${res.status}`
      }`
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
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: toBase64Url(input.rawMime),
      }),
    }
  );

  const json = (await res.json().catch(() => null)) as
    | GmailSendResponse
    | null;

  if (!res.ok) {
    const details =
      typeof json === "object" && json !== null
        ? JSON.stringify(json)
        : `HTTP_${res.status}`;

    throw new Error(`GMAIL_SEND_FAILED: ${details}`);
  }

  return json ?? {};
}

export async function POST(req: Request) {
  try {
    const userId = await getEffectiveUserId(req);
    const body = (await req.json().catch(() => ({}))) as SendContactManagerEmailBody;

    const contactId = String(body.contactId || "").trim();
    const message = String(body.message || "").trim();
    const replyTo = String(body.replyTo || "").trim();

    if (!isUuid(contactId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_ID_REQUIRED",
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          ok: false,
          error: "MESSAGE_REQUIRED",
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

    const contact = await getContactManagerItem(userId, contactId);

    if (contact.is_archived) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_ARCHIVED",
        },
        { status: 400 }
      );
    }

    if (
      contact.do_not_contact ||
      String(contact.status || "").toLowerCase() === "stop_contact"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_MARKED_DO_NOT_CONTACT",
          details:
            contact.do_not_contact_reason ||
            "This lead is marked as stop-contact.",
        },
        { status: 400 }
      );
    }

    const toEmail = normalizeEmail(contact.email);

    if (!toEmail || !isValidEmail(toEmail)) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONTACT_EMAIL_MISSING_OR_INVALID",
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

    const subject = buildSubject(contact, body.subject);

    const rawMime = buildRawMime({
      fromEmail: inbox.email,
      fromName: inbox.display_name,
      to: [toEmail],
      subject,
      text: message,
      replyTo: replyTo || undefined,
    });

    let sendResult: GmailSendResponse | null = null;

    try {
      sendResult = await sendViaGmail({
        accessToken,
        rawMime,
      });
    } catch (err: any) {
      const errorMessage = String(err?.message ?? "");

      if (
        tokenRow.refresh_token &&
        (errorMessage.includes("401") ||
          errorMessage.includes("invalid_grant") ||
          errorMessage.includes("Invalid Credentials") ||
          errorMessage.includes("GMAIL_SEND_FAILED"))
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
    const previousStatus = contact.status || null;

    const { data: updatedItem, error: updateError } = await supabase
      .from("contact_manager_items")
      .update({
        status: "contacted",
        suggested_opener: message,
        next_step: "Email sent. Wait for reply or set a follow-up reminder.",
        last_touch_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", contact.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new Error(`CONTACT_UPDATE_AFTER_SEND_FAILED: ${updateError.message}`);
    }

    const { data: activity, error: activityError } = await supabase
      .from("contact_manager_activity_log")
      .insert({
        user_id: userId,
        contact_manager_item_id: contact.id,
        activity_type: "email_sent",
        title: "Email sent",
        description: `Email sent to ${toEmail}.`,
        previous_status: previousStatus,
        new_status: "contacted",
        message_snapshot: message,
        notes_snapshot: contact.notes || null,
        next_follow_up_at: null,
        meta: {
          provider: "gmail",
          inbox_id: inbox.id,
          from: inbox.email,
          to: toEmail,
          subject,
          provider_message_id: sendResult?.id ?? null,
          provider_thread_id: sendResult?.threadId ?? null,
        },
      })
      .select("*")
      .maybeSingle();

    if (activityError) {
      throw new Error(`EMAIL_ACTIVITY_LOG_FAILED: ${activityError.message}`);
    }

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
        item: updatedItem,
        activity,
        sent: {
          to: toEmail,
          subject,
          providerMessageId: sendResult?.id ?? null,
          providerThreadId: sendResult?.threadId ?? null,
          at: nowIso,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message || "CONTACT_MANAGER_EMAIL_SEND_FAILED";

    const status =
      msg === "UNAUTHORIZED"
        ? 401
        : msg.includes("CONTACT_ID_REQUIRED") ||
            msg.includes("MESSAGE_REQUIRED") ||
            msg.includes("CONTACT_NOT_FOUND") ||
            msg.includes("CONTACT_EMAIL_MISSING_OR_INVALID") ||
            msg.includes("NO_ACTIVE_CONNECTED_INBOX") ||
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