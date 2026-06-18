import { getSupabaseAdmin } from "@/lib/supabase/server";
import { recordBusinessEvent } from "./eventsService";

type ActiveInboxRow = {
  id: string;
  user_id: string;
  provider: string;
  email: string | null;
  display_name: string | null;
  status: string | null;
  is_active: boolean | null;
  sync_replies_enabled: boolean | null;
};

type ActiveTokenRow = {
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
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailListThreadsResponse = {
  threads?: Array<{
    id?: string;
    snippet?: string;
    historyId?: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailThreadResponse = {
  id?: string;
  historyId?: string;
  snippet?: string;
  messages?: Array<{
    id?: string;
    threadId?: string;
    internalDate?: string;
    payload?: {
      headers?: Array<{
        name?: string;
        value?: string;
      }>;
      mimeType?: string;
      body?: {
        size?: number;
        data?: string;
      };
      parts?: Array<any>;
    };
    snippet?: string;
    labelIds?: string[];
  }>;
};

type SentBusinessEventRow = {
  id: string;
  user_id: string;
  target_id: string;
  created_at: string;
  meta: {
    provider?: string;
    providerThreadId?: string;
    providerMessageId?: string;
    to?: string;
    subject?: string;
    [key: string]: any;
  } | null;
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

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now() + 60_000;
}

function getHeaderValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string
) {
  const found = (headers ?? []).find(
    (item) => String(item?.name ?? "").trim().toLowerCase() === headerName.toLowerCase()
  );
  return String(found?.value ?? "").trim() || null;
}

function decodeBase64Url(input: string | null | undefined) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  try {
    return Buffer.from(normalized + padding, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  const parts = Array.isArray(payload.parts) ? payload.parts : [];

  for (const part of parts) {
    if (part?.mimeType === "text/plain" && part?.body?.data) {
      const text = decodeBase64Url(part.body.data);
      if (text.trim()) return text;
    }
  }

  for (const part of parts) {
    if (part?.body?.data) {
      const text = decodeBase64Url(part.body.data);
      if (text.trim()) return text;
    }
  }

  return "";
}

function classifyReply(input: {
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
}) {
  const combined = `${input.subject ?? ""}\n${input.snippet ?? ""}\n${input.bodyText ?? ""}`
    .toLowerCase()
    .trim();

  if (!combined) {
    return "reply" as const;
  }

  const stopSignals = [
    "stop",
    "unsubscribe",
    "remove me",
    "do not contact",
    "don't contact",
    "dont contact",
    "cease",
  ];

  const negativeSignals = [
    "not interested",
    "no thanks",
    "no thank you",
    "no, thanks",
    "not for us",
    "not a fit",
    "no interest",
    "not now",
  ];

  if (stopSignals.some((signal) => combined.includes(signal))) {
    return "stop" as const;
  }

  if (negativeSignals.some((signal) => combined.includes(signal))) {
    return "no" as const;
  }

  return "reply" as const;
}

async function getActiveInbox(userId: string): Promise<ActiveInboxRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("user_connected_inboxes")
    .select(
      "id,user_id,provider,email,display_name,status,is_active,sync_replies_enabled"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "connected")
    .eq("sync_replies_enabled", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`ACTIVE_INBOX_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("NO_ACTIVE_REPLY_SYNC_INBOX");
  }

  return data as ActiveInboxRow;
}

async function getActiveToken(inboxId: string, userId: string): Promise<ActiveTokenRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("user_connected_inbox_tokens")
    .select(
      "id,inbox_id,user_id,provider,access_token,refresh_token,token_type,scope,expires_at,is_active"
    )
    .eq("inbox_id", inboxId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`ACTIVE_TOKEN_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id || !data.access_token) {
    throw new Error("NO_ACTIVE_REPLY_SYNC_TOKEN");
  }

  return data as ActiveTokenRow;
}

async function refreshGoogleAccessToken(tokenRow: ActiveTokenRow) {
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

  return json.access_token;
}

async function listRecentGmailThreads(accessToken: string, inboxEmail: string) {
  const query = `in:inbox newer_than:14d -from:${inboxEmail}`;
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "25");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await res.json().catch(() => null)) as GmailListThreadsResponse | null;

  if (!res.ok) {
    throw new Error(`GMAIL_THREAD_LIST_FAILED: HTTP_${res.status}`);
  }

  return json?.threads ?? [];
}

async function getGmailThread(accessToken: string, threadId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`);
  url.searchParams.set("format", "full");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await res.json().catch(() => null)) as GmailThreadResponse | null;

  if (!res.ok || !json?.id) {
    throw new Error(`GMAIL_THREAD_READ_FAILED: HTTP_${res.status}`);
  }

  return json;
}

async function getRecentSentBusinessEvents(userId: string): Promise<SentBusinessEventRow[]> {
  const supabase = getSupabaseAdmin();

  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("business_events")
    .select("id,user_id,target_id,created_at,meta")
    .eq("user_id", userId)
    .eq("event_type", "sent")
    .eq("channel", "email")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`SENT_EVENTS_LOOKUP_FAILED: ${error.message}`);
  }

  return (data ?? []) as SentBusinessEventRow[];
}

async function hasExistingReplyEvent(input: {
  userId: string;
  targetId: string;
  providerThreadId?: string | null;
  providerMessageId?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_events")
    .select("id,meta")
    .eq("user_id", input.userId)
    .eq("target_id", input.targetId)
    .eq("event_type", "reply")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`REPLY_DEDUPE_LOOKUP_FAILED: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; meta: Record<string, any> | null }>;

  return rows.some((row) => {
    const meta = row.meta ?? {};
    const existingThreadId = String(meta.providerThreadId ?? "").trim();
    const existingMessageId = String(meta.providerMessageId ?? "").trim();

    return (
      (!!input.providerThreadId && existingThreadId === input.providerThreadId) ||
      (!!input.providerMessageId && existingMessageId === input.providerMessageId)
    );
  });
}

function findMatchingSentEvent(
  sentEvents: SentBusinessEventRow[],
  threadId: string | null,
  messageHeaders: Array<{ name?: string; value?: string }> | undefined
) {
  const inReplyTo = getHeaderValue(messageHeaders, "In-Reply-To");
  const references = getHeaderValue(messageHeaders, "References");

  const cleanHeader = (value: string | null) =>
    String(value ?? "")
      .replace(/[<>]/g, "")
      .trim();

  const cleanInReplyTo = cleanHeader(inReplyTo);
  const cleanReferences = cleanHeader(references);

  return sentEvents.find((event) => {
    const meta = event.meta ?? {};
    const eventThreadId = String(meta.providerThreadId ?? "").trim();
    const eventMessageId = cleanHeader(String(meta.providerMessageId ?? "").trim());

    if (threadId && eventThreadId && threadId === eventThreadId) {
      return true;
    }

    if (eventMessageId && cleanInReplyTo && cleanInReplyTo.includes(eventMessageId)) {
      return true;
    }

    if (eventMessageId && cleanReferences && cleanReferences.includes(eventMessageId)) {
      return true;
    }

    return false;
  });
}

export async function syncRepliesForUser(input: { userId: string }) {
  const inbox = await getActiveInbox(input.userId);

  if (inbox.provider !== "gmail") {
    throw new Error("REPLY_SYNC_PROVIDER_NOT_SUPPORTED");
  }

  if (!inbox.email) {
    throw new Error("REPLY_SYNC_INBOX_EMAIL_MISSING");
  }

  const tokenRow = await getActiveToken(inbox.id, input.userId);

  let accessToken = tokenRow.access_token;

  if (isExpired(tokenRow.expires_at)) {
    accessToken = await refreshGoogleAccessToken(tokenRow);
  }

  const sentEvents = await getRecentSentBusinessEvents(input.userId);
  const threads = await listRecentGmailThreads(accessToken, inbox.email);

  let matchedThreads = 0;
  let newReplyEvents = 0;
  const processedTargetIds = new Set<string>();

  for (const thread of threads) {
    const threadId = String(thread?.id ?? "").trim();
    if (!threadId) continue;

    const fullThread = await getGmailThread(accessToken, threadId);
    const messages = Array.isArray(fullThread.messages) ? fullThread.messages : [];
    if (!messages.length) continue;

    const latestMessage = messages[messages.length - 1];
    const latestHeaders = latestMessage?.payload?.headers;
    const fromEmail = normalizeEmail(getHeaderValue(latestHeaders, "From"));
    const subject = getHeaderValue(latestHeaders, "Subject");
    const bodyText = extractBodyFromPayload(latestMessage?.payload);
    const snippet = String(latestMessage?.snippet ?? fullThread.snippet ?? "").trim();
    const latestMessageId = String(latestMessage?.id ?? "").trim();

    if (!fromEmail || fromEmail.includes(normalizeEmail(inbox.email))) {
      continue;
    }

    const matchedSentEvent = findMatchingSentEvent(sentEvents, threadId, latestHeaders);
    if (!matchedSentEvent?.target_id) {
      continue;
    }

    matchedThreads += 1;

    const alreadyLogged = await hasExistingReplyEvent({
      userId: input.userId,
      targetId: matchedSentEvent.target_id,
      providerThreadId: threadId || null,
      providerMessageId: latestMessageId || null,
    });

    if (alreadyLogged) {
      continue;
    }

    const replyType = classifyReply({
      subject,
      snippet,
      bodyText,
    });

    await recordBusinessEvent({
      userId: input.userId,
      targetId: matchedSentEvent.target_id,
      eventType: replyType,
      channel: "email",
      meta: {
        source: "gmail_reply_sync",
        inboxEmail: inbox.email,
        provider: "gmail",
        providerThreadId: threadId || null,
        providerMessageId: latestMessageId || null,
        fromEmail,
        subject: subject ?? null,
        snippet: snippet || null,
        bodyPreview: bodyText ? bodyText.slice(0, 1200) : null,
        syncedAt: new Date().toISOString(),
        replyClassification: replyType,
      },
    });

    newReplyEvents += 1;
    processedTargetIds.add(matchedSentEvent.target_id);
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  await supabase
    .from("user_connected_inboxes")
    .update({
      last_sync_at: nowIso,
      last_error: null,
    })
    .eq("id", inbox.id);

  return {
    ok: true as const,
    provider: "gmail" as const,
    inboxId: inbox.id,
    inboxEmail: inbox.email,
    matchedThreads,
    newReplyEvents,
    processedTargetIds: Array.from(processedTargetIds),
    syncedAt: nowIso,
  };
}