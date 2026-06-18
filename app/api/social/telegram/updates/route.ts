import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Temperature = "hot" | "warm" | "cold";

type TelegramChatType = "private" | "group" | "supergroup" | "channel";

type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type: TelegramChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  text?: string;
  caption?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type TelegramLeadSignal = {
  externalId: string;
  sourcePlatform: "telegram";
  sourceType: "telegram_message" | "telegram_channel_post";
  sourceUrl: string | null;
  sourceChatId: string;
  sourceChatTitle: string | null;
  sourceChatType: TelegramChatType;
  sourceUsername: string | null;
  sourceAuthorName: string | null;
  sourceText: string;
  publishedAt: string | null;
  score: number;
  temperature: Temperature;
  whyMatched: string[];
  suggestedOpener: string;
  tags: string[];
  raw: {
    update_id: number;
    message_id: number;
    chat: TelegramChat;
    from?: TelegramUser;
  };
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_STATE_ID = "autoaffi_lead_scanner_bot";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      source: "telegram",
      route: "/api/social/telegram/updates",
      error: message,
      details,
    },
    { status }
  );
}

function checkInternalAuth(req: NextRequest) {
  // Local dev is allowed without auth to make testing faster.
  // Production should always be protected.
  if (process.env.NODE_ENV !== "production") return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function cleanText(text: string | null | undefined) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function boolParam(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function hasRealQuestionIntent(text: string) {
  const cleaned = cleanText(text).toLowerCase();

  if (cleaned.includes("?")) return true;

  return (
    /^(how|what|which|where|when|why|can|should|would|do|does|is|are)\b/i.test(
      cleaned
    ) ||
    /\b(can you|could you|do you think|would you recommend|what should i|how can i|how do i|which platform|what platform)\b/i.test(
      cleaned
    )
  );
}

function isMostlyJunk(text: string) {
  const cleaned = cleanText(text);
  if (cleaned.length < 12) return true;

  const urlCount = (cleaned.match(/https?:\/\//gi) || []).length;
  if (urlCount >= 2) return true;

  const repeatedChars = /(.)\1{8,}/.test(cleaned);
  if (repeatedChars) return true;

  const emojiHeavy =
    [...cleaned].filter((char) => /\p{Extended_Pictographic}/u.test(char))
      .length > cleaned.length * 0.4;

  if (emojiHeavy) return true;

  return false;
}

const HOT_PATTERNS = [
  /i want to start/i,
  /i need (your )?help/i,
  /please guide me/i,
  /can you guide me/i,
  /help me (start|begin|get started)/i,
  /how (do|can) i (start|begin|get started)/i,
  /^how to (start|begin|get started)/i,
  /i am new/i,
  /i'm new/i,
  /complete beginner/i,
  /absolute beginner/i,
  /zero audience/i,
  /no audience/i,
  /no followers/i,
  /no clicks/i,
  /no sales/i,
  /no leads/i,
  /not getting (clicks|sales|leads|traffic)/i,
  /struggling/i,
  /i tried .*affiliate/i,
  /i failed/i,
  /does this actually work/i,
  /is this legit/i,
  /what should i do/i,
  /which platform/i,
  /recommend .*platform/i,
  /better .*platform/i,
];

const WARM_PATTERNS = [
  /affiliate marketing/i,
  /make money online/i,
  /extra income/i,
  /side hustle/i,
  /passive income/i,
  /online business/i,
  /recurring (income|commission)/i,
  /earn money/i,
  /earning money/i,
  /income stream/i,
  /digital product/i,
  /ai tool/i,
  /content creation/i,
  /faceless/i,
  /tiktok shop/i,
  /youtube automation/i,
  /dropshipping/i,
  /work from home/i,
  /financial freedom/i,
];

const LOW_ACTION_PATTERNS = [
  /great/i,
  /fantastic/i,
  /thanks/i,
  /thank you/i,
  /helpful/i,
  /awesome/i,
  /very clear/i,
  /super clear/i,
  /love this/i,
  /good content/i,
  /nice/i,
  /cool/i,
];

const SUCCESS_STORY_PATTERNS = [
  /i made \$?\d+/i,
  /made \$?\d+/i,
  /hit \$?\d+/i,
  /earned \$?\d+/i,
  /commission in month/i,
  /paying the mortgage/i,
  /my blog made/i,
  /ad revenue/i,
  /book sales/i,
];

const POSSIBLE_PROMO_PATTERNS = [
  /dm me/i,
  /message me/i,
  /join my/i,
  /check my/i,
  /link in bio/i,
  /whatsapp/i,
  /guaranteed/i,
  /earn \$?\d+ daily/i,
  /crypto/i,
  /investment/i,
  /forex/i,
];

const TRUST_CONCERN_PATTERNS = [
  /scam/i,
  /fake guru/i,
  /pyramid/i,
  /mlm/i,
  /get rich quick/i,
  /spam/i,
];

function scoreTelegramIntent(text: string) {
  const cleaned = cleanText(text);

  let score = 0;
  const whyMatched: string[] = [];
  const tags = new Set<string>();

  const hasQuestion = hasRealQuestionIntent(cleaned);

  const hasHelpIntent =
    /(i need help|need your help|please guide me|can you guide me|help me|get started|want to start|how do i start|how can i start)/i.test(
      cleaned
    );

  const hasPlatformIntent =
    /(which platform|recommend.*platform|better.*platform|what platform|amazon or|tool|system|software|automation|tracking)/i.test(
      cleaned
    );

  const hasPain =
    /(failed|tried|not working|no clicks|no sales|no leads|no traffic|struggling|stuck|confused)/i.test(
      cleaned
    );

  const hasBeginner =
    /(beginner|newbie|new to|starting|start from zero|zero audience|no audience|no experience|no followers)/i.test(
      cleaned
    );

  const hasAffiliate = /(affiliate|affiliate marketing|commission)/i.test(
    cleaned
  );

  const hasIncome =
    /(money|income|cash|earn|earning|revenue|commission|side hustle|passive income|make money online)/i.test(
      cleaned
    );

  const isLowAction = LOW_ACTION_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  const isSuccessStory = SUCCESS_STORY_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  const isPossiblePromo = POSSIBLE_PROMO_PATTERNS.some((pattern) =>
    pattern.test(cleaned)
  );

  for (const pattern of HOT_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 18;
      tags.add("high-intent");
    }
  }

  for (const pattern of WARM_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 7;
      tags.add("warm-intent");
    }
  }

  if (hasHelpIntent) {
    score += 32;
    whyMatched.push("Explicitly asks for help or guidance");
    tags.add("needs-help");
  }

  if (hasQuestion) {
    score += 12;
    whyMatched.push("Asks a question");
    tags.add("question");
  }

  if (hasBeginner) {
    score += 16;
    whyMatched.push("Shows beginner/startup intent");
    tags.add("beginner");
  }

  if (hasPain) {
    score += 18;
    whyMatched.push("Shows frustration or failed attempt");
    tags.add("pain-point");
  }

  if (hasPlatformIntent) {
    score += 18;
    whyMatched.push("Looks open to a platform, tool or system");
    tags.add("tool-interest");
  }

  if (hasAffiliate) {
    score += 12;
    whyMatched.push("Mentions affiliate marketing");
    tags.add("affiliate");
  }

  if (hasIncome) {
    score += 12;
    whyMatched.push("Mentions money, income or commissions");
    tags.add("income");
  }

  for (const pattern of TRUST_CONCERN_PATTERNS) {
    if (pattern.test(cleaned)) {
      score += 6;
      whyMatched.push("Mentions trust/risk concern");
      tags.add("trust-concern");
    }
  }

  if (cleaned.length > 80) {
    score += 4;
    whyMatched.push("Detailed message");
  }

  if (isLowAction && !hasQuestion && !hasHelpIntent && !hasPain) {
    score -= 35;
    tags.add("low-action");
    whyMatched.push("Mostly low-action message");
  }

  if (isSuccessStory && !hasQuestion && !hasHelpIntent && !hasPain) {
    score -= 35;
    tags.add("success-story");
    whyMatched.push("Looks more like a success story than a lead request");
  }

  if (isPossiblePromo) {
    score -= 35;
    tags.add("possible-promo");
    whyMatched.push("May be promotional or low-quality outreach");
  }

  if (
    (hasHelpIntent || hasBeginner || hasPain) &&
    (hasAffiliate || hasIncome) &&
    !isLowAction &&
    !isSuccessStory &&
    !isPossiblePromo
  ) {
    score += 18;
    tags.add("autoaffi-fit");
    whyMatched.push("Strong Autoaffi fit");
  }

  score = Math.min(100, Math.max(0, score));

  const temperature: Temperature =
    score >= 72 ? "hot" : score >= 45 ? "warm" : "cold";

  const uniqueWhy = Array.from(new Set(whyMatched)).slice(0, 6);

  return {
    score,
    temperature,
    whyMatched:
      uniqueWhy.length > 0
        ? uniqueWhy
        : ["Matches online-income related language"],
    tags: Array.from(tags).slice(0, 10),
  };
}

function passesLeadIntentGate(signal: TelegramLeadSignal) {
  const tags = new Set(signal.tags);

  return (
    tags.has("needs-help") ||
    tags.has("question") ||
    tags.has("beginner") ||
    tags.has("pain-point") ||
    tags.has("tool-interest") ||
    tags.has("trust-concern") ||
    signal.score >= 72
  );
}

function buildSuggestedOpener(text: string) {
  if (
    /(i need help|need your help|please guide me|can you guide me|help me|get started|want to start|how do i start|how can i start)/i.test(
      text
    )
  ) {
    return "I saw your message about wanting to get started. The easiest way to avoid getting overwhelmed is to follow one simple workflow: pick one offer, create daily content around the problem it solves, and track every click so you know what works.";
  }

  if (
    /(no clicks|no sales|no leads|no traffic|struggling|failed|not working|stuck|confused)/i.test(
      text
    )
  ) {
    return "I saw your message about struggling with online income or affiliate marketing. Most people do not fail because of the offer — they fail because they post without a clear workflow or tracking. I’d start with one offer, simple content, and separate tracking links.";
  }

  if (
    /(which platform|recommend.*platform|better.*platform|what platform|amazon or|tool|system|software|automation|tracking)/i.test(
      text
    )
  ) {
    return "I saw your message about choosing the right platform or system. I’d look for something that helps with three things: choosing the right offer, creating consistent content, and tracking results properly.";
  }

  if (/affiliate/i.test(text)) {
    return "I saw your message about affiliate marketing. A simple way to start is to choose one clear offer, create helpful content around the problem it solves, and track each post separately so you can see what gets clicks.";
  }

  return "I saw your message and thought it was relevant. If you are trying to build online income, I’d focus on one clear offer, simple content, and proper tracking before adding more platforms.";
}

function getMessageFromUpdate(update: TelegramUpdate) {
  const message =
    update.message ||
    update.channel_post ||
    update.edited_message ||
    update.edited_channel_post ||
    null;

  if (!message) return null;

  const updateType = update.channel_post || update.edited_channel_post
    ? "telegram_channel_post"
    : "telegram_message";

  return {
    message,
    updateType: updateType as "telegram_message" | "telegram_channel_post",
  };
}

function getAuthorName(message: TelegramMessage) {
  if (message.from) {
    return cleanText(
      [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    );
  }

  if (message.sender_chat?.title) {
    return cleanText(message.sender_chat.title);
  }

  return null;
}

function buildTelegramSourceUrl(chat: TelegramChat, messageId: number) {
  if (chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }

  // Private/supergroup IDs are not always directly linkable.
  // We still store chat_id and message_id for internal tracking.
  return null;
}

function normalizeTelegramUpdateToSignal(
  update: TelegramUpdate
): TelegramLeadSignal | null {
  const picked = getMessageFromUpdate(update);
  if (!picked) return null;

  const { message, updateType } = picked;
  const sourceText = cleanText(message.text || message.caption);

  if (!sourceText || isMostlyJunk(sourceText)) return null;

  const scoring = scoreTelegramIntent(sourceText);

  if (scoring.score < 30) return null;

  const chat = message.chat;
  const chatId = String(chat.id);
  const authorName = getAuthorName(message);
  const username = message.from?.username || chat.username || null;

  const publishedAt = message.date
    ? new Date(message.date * 1000).toISOString()
    : null;

  const signal: TelegramLeadSignal = {
    externalId: `telegram_${chatId}_${message.message_id}`,
    sourcePlatform: "telegram",
    sourceType: updateType,
    sourceUrl: buildTelegramSourceUrl(chat, message.message_id),
    sourceChatId: chatId,
    sourceChatTitle:
      cleanText(chat.title || chat.first_name || chat.username || "") || null,
    sourceChatType: chat.type,
    sourceUsername: username,
    sourceAuthorName: authorName,
    sourceText,
    publishedAt,
    score: scoring.score,
    temperature: scoring.temperature,
    whyMatched: scoring.whyMatched,
    suggestedOpener: buildSuggestedOpener(sourceText),
    tags: scoring.tags,
    raw: {
      update_id: update.update_id,
      message_id: message.message_id,
      chat,
      from: message.from,
    },
  };

  if (!passesLeadIntentGate(signal)) return null;

  return signal;
}

async function telegramGetUpdates(params: {
  offset?: number | null;
  limit: number;
}) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const url = new URL(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`
  );

  if (params.offset) {
    url.searchParams.set("offset", String(params.offset));
  }

  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("timeout", "0");
  url.searchParams.set(
    "allowed_updates",
    JSON.stringify([
      "message",
      "channel_post",
      "edited_message",
      "edited_channel_post",
    ])
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | TelegramApiResponse<TelegramUpdate[]>
    | null;

  if (!res.ok || !json?.ok) {
    throw new Error(
      `Telegram getUpdates failed: ${res.status} ${JSON.stringify(json)}`
    );
  }

  return Array.isArray(json.result) ? json.result : [];
}

async function getTelegramBotState() {
  const { data, error } = await supabaseAdmin
    .from("telegram_bot_state")
    .select("id, last_update_id, updated_at")
    .eq("id", BOT_STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch telegram_bot_state: ${error.message}`);
  }

  return data as { id: string; last_update_id: number | null; updated_at: string } | null;
}

async function saveTelegramBotState(lastUpdateId: number) {
  const { error } = await supabaseAdmin.from("telegram_bot_state").upsert(
    {
      id: BOT_STATE_ID,
      last_update_id: lastUpdateId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    throw new Error(`Failed to save telegram_bot_state: ${error.message}`);
  }
}

function getSourceTypeForChat(chatType: TelegramChatType) {
  if (chatType === "channel") return "telegram_channel";
  if (chatType === "group" || chatType === "supergroup") {
    return "telegram_group";
  }

  return "telegram_private";
}

function getTelegramSourceUrlFromChat(chat: TelegramChat) {
  if (chat.username) return `https://t.me/${chat.username}`;
  return `telegram://chat/${chat.id}`;
}

function dedupeChatsFromUpdates(updates: TelegramUpdate[]) {
  const map = new Map<string, TelegramChat>();

  for (const update of updates) {
    const picked = getMessageFromUpdate(update);
    if (!picked) continue;

    const chat = picked.message.chat;
    map.set(String(chat.id), chat);
  }

  return Array.from(map.values());
}

async function saveDiscoveredTelegramSources(params: {
  chats: TelegramChat[];
  niche: string;
  intentGroup: string;
}) {
  const saved: any[] = [];
  const skipped: any[] = [];

  for (const chat of params.chats) {
    if (chat.type === "private") {
      skipped.push({
        chatId: String(chat.id),
        reason: "private_chat_not_added_to_global_source_bank",
      });
      continue;
    }

    const sourceExternalId = String(chat.id);
    const sourceType = getSourceTypeForChat(chat.type);

    const sourceRow = {
      platform: "telegram",
      source_type: sourceType,
      source_url: getTelegramSourceUrlFromChat(chat),
      source_external_id: sourceExternalId,
      title: cleanText(chat.title || chat.username || `Telegram ${chat.id}`),
      description: "Discovered by Autoaffi Telegram updates scanner",
      niche: params.niche,
      intent_group: params.intentGroup,
      enabled: true,
      priority: 75,
      scan_frequency: "daily",
      max_results: 50,
      tags: ["telegram", chat.type, params.niche, params.intentGroup],
      config: {
        chat_id: sourceExternalId,
        chat_type: chat.type,
        username: chat.username || null,
        discovered_by: "telegram_updates_route",
      },
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("global_social_lead_sources")
      .select("id")
      .eq("platform", "telegram")
      .eq("source_external_id", sourceExternalId)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Failed to check existing telegram source: ${existingError.message}`
      );
    }

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("global_social_lead_sources")
        .update(sourceRow)
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(`Failed to update telegram source: ${updateError.message}`);
      }

      saved.push({
        action: "updated",
        id: existing.id,
        chatId: sourceExternalId,
        title: sourceRow.title,
        sourceType,
      });

      continue;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("global_social_lead_sources")
      .insert(sourceRow)
      .select("id")
      .maybeSingle();

    if (insertError) {
      throw new Error(`Failed to insert telegram source: ${insertError.message}`);
    }

    saved.push({
      action: "inserted",
      id: inserted?.id,
      chatId: sourceExternalId,
      title: sourceRow.title,
      sourceType,
    });
  }

  return {
    saved,
    skipped,
  };
}

function summarizeUpdates(updates: TelegramUpdate[]) {
  let messages = 0;
  let channelPosts = 0;
  let editedMessages = 0;
  let editedChannelPosts = 0;

  for (const update of updates) {
    if (update.message) messages += 1;
    if (update.channel_post) channelPosts += 1;
    if (update.edited_message) editedMessages += 1;
    if (update.edited_channel_post) editedChannelPosts += 1;
  }

  return {
    messages,
    channelPosts,
    editedMessages,
    editedChannelPosts,
  };
}

async function handle(req: NextRequest) {
  try {
    if (!checkInternalAuth(req)) {
      return jsonError("Unauthorized", 401);
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return jsonError("Missing TELEGRAM_BOT_TOKEN in .env.local", 500);
    }

    const url = new URL(req.url);

    const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);

    // preview=true means do not move offset.
    // commit=true means save latest update id to telegram_bot_state.
    const preview = boolParam(url.searchParams.get("preview"), true);
    const commit = boolParam(url.searchParams.get("commit"), false);
    const saveSources = boolParam(url.searchParams.get("saveSources"), false);
    const ignoreOffset = boolParam(url.searchParams.get("ignoreOffset"), false);

    const niche = cleanText(url.searchParams.get("niche")) || "affiliate_income";
    const intentGroup =
      cleanText(url.searchParams.get("intentGroup")) || "affiliate_beginner";

    const state = await getTelegramBotState();

    const offset =
      !ignoreOffset && state?.last_update_id
        ? Number(state.last_update_id) + 1
        : null;

    const updates = await telegramGetUpdates({
      offset,
      limit,
    });

    const signals = updates
      .map((update) => normalizeTelegramUpdateToSignal(update))
      .filter(Boolean) as TelegramLeadSignal[];

    const discoveredChats = dedupeChatsFromUpdates(updates);

    const maxUpdateId =
      updates.length > 0
        ? Math.max(...updates.map((update) => Number(update.update_id)))
        : null;

    let sourceSaveResult: Awaited<
      ReturnType<typeof saveDiscoveredTelegramSources>
    > | null = null;

    if (saveSources && discoveredChats.length > 0) {
      sourceSaveResult = await saveDiscoveredTelegramSources({
        chats: discoveredChats,
        niche,
        intentGroup,
      });
    }

    const shouldCommitOffset = commit && !preview && maxUpdateId !== null;

    if (shouldCommitOffset) {
      await saveTelegramBotState(maxUpdateId);
    }

    return NextResponse.json({
      ok: true,
      source: "telegram",
      route: "/api/social/telegram/updates",
      mode: preview ? "preview" : "commit",
      config: {
        limit,
        preview,
        commit,
        saveSources,
        ignoreOffset,
        niche,
        intentGroup,
        offsetUsed: offset,
        previousLastUpdateId: state?.last_update_id ?? null,
        latestUpdateId: maxUpdateId,
        offsetSaved: shouldCommitOffset ? maxUpdateId : null,
      },
      summary: {
        updatesFound: updates.length,
        ...summarizeUpdates(updates),
        discoveredChats: discoveredChats.length,
        matchedSignals: signals.length,
        hot: signals.filter((s) => s.temperature === "hot").length,
        warm: signals.filter((s) => s.temperature === "warm").length,
        cold: signals.filter((s) => s.temperature === "cold").length,
      },
      chats: discoveredChats.map((chat) => ({
        chatId: String(chat.id),
        type: chat.type,
        title: chat.title || chat.first_name || null,
        username: chat.username || null,
        sourceType: getSourceTypeForChat(chat.type),
        sourceUrl: getTelegramSourceUrlFromChat(chat),
      })),
      signals: signals.map((signal) => ({
        externalId: signal.externalId,
        sourcePlatform: signal.sourcePlatform,
        sourceType: signal.sourceType,
        sourceUrl: signal.sourceUrl,
        sourceChatId: signal.sourceChatId,
        sourceChatTitle: signal.sourceChatTitle,
        sourceChatType: signal.sourceChatType,
        sourceUsername: signal.sourceUsername,
        sourceAuthorName: signal.sourceAuthorName,
        sourceText: signal.sourceText,
        publishedAt: signal.publishedAt,
        score: signal.score,
        temperature: signal.temperature,
        whyMatched: signal.whyMatched,
        suggestedOpener: signal.suggestedOpener,
        tags: signal.tags,
      })),
      sourceSaveResult,
      nextStep:
        signals.length > 0
          ? "Telegram messages are being detected and scored. Next: connect Telegram source scanning into /api/cron/social-lead-refresh."
          : "No lead-like Telegram messages detected yet. Add bot to approved groups/channels and wait for new messages/posts.",
    });
  } catch (error) {
    console.error("[telegram-updates-route]", error);

    return jsonError(
      "Telegram updates scan failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}