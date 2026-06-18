import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
};

type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      source: "telegram",
      route: "/api/social/telegram/me",
      error: message,
      details,
    },
    { status }
  );
}

function maskToken(token: string) {
  const trimmed = token.trim();

  if (trimmed.length <= 16) {
    return "********";
  }

  const [botId, secret] = trimmed.split(":");

  if (!botId || !secret) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }

  return `${botId}:${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function validateTelegramTokenFormat(token: string) {
  const trimmed = token.trim();

  // Telegram bot tokens normally look like:
  // 123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  const valid = /^\d+:[A-Za-z0-9_-]{20,}$/.test(trimmed);

  return {
    valid,
    masked: maskToken(trimmed),
  };
}

async function telegramGet<T>(method: string): Promise<{
  ok: boolean;
  status: number;
  data: TelegramApiResponse<T> | null;
}> {
  if (!TELEGRAM_BOT_TOKEN) {
    return {
      ok: false,
      status: 500,
      data: null,
    };
  }

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = (await res.json().catch(() => null)) as TelegramApiResponse<T> | null;

  return {
    ok: res.ok && data?.ok === true,
    status: res.status,
    data,
  };
}

function buildReadiness(bot: TelegramBotInfo, webhook: TelegramWebhookInfo | null) {
  const warnings: string[] = [];
  const nextSteps: string[] = [];

  if (!bot.is_bot) {
    warnings.push("Telegram returned an account that is not marked as a bot.");
  }

  if (!bot.username) {
    warnings.push("Bot username is missing.");
  }

  if (bot.username && bot.username !== "autoaffi_lead_scanner_bot") {
    warnings.push(
      `Bot username is ${bot.username}. Expected autoaffi_lead_scanner_bot if this is the intended Autoaffi bot.`
    );
  }

  if (bot.can_join_groups === false) {
    warnings.push("Bot cannot join groups. Enable group access in BotFather if needed.");
  }

  if (bot.can_read_all_group_messages === false) {
    warnings.push(
      "Bot privacy mode may prevent reading normal group messages. For group scanning, disable privacy mode in BotFather or use channels where the bot receives posts."
    );
  }

  if (webhook?.url) {
    warnings.push(
      "Webhook is currently set. If you use polling/getUpdates in development, webhook must be cleared first."
    );
  }

  nextSteps.push("Add the bot to a private test group or channel.");
  nextSteps.push("Send a few test messages containing affiliate/money/side-hustle intent.");
  nextSteps.push("Create the Telegram updates route to read messages.");
  nextSteps.push("Insert Telegram source into global_social_lead_sources.");
  nextSteps.push("Connect Telegram scanning into /api/cron/social-lead-refresh.");

  return {
    readyForBotApi: true,
    readyForPollingDev: !webhook?.url,
    readyForGroupScanning:
      bot.can_join_groups !== false && bot.can_read_all_group_messages !== false,
    warnings,
    nextSteps,
  };
}

export async function GET() {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return jsonError("Missing TELEGRAM_BOT_TOKEN in .env.local", 500, {
        envName: "TELEGRAM_BOT_TOKEN",
        expectedFormat: "123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      });
    }

    const tokenCheck = validateTelegramTokenFormat(TELEGRAM_BOT_TOKEN);

    if (!tokenCheck.valid) {
      return jsonError("Invalid TELEGRAM_BOT_TOKEN format", 500, {
        maskedToken: tokenCheck.masked,
        expectedFormat: "123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        note: "Make sure you pasted the real token from BotFather, not the placeholder value.",
      });
    }

    const [meResult, webhookResult] = await Promise.all([
      telegramGet<TelegramBotInfo>("getMe"),
      telegramGet<TelegramWebhookInfo>("getWebhookInfo"),
    ]);

    if (!meResult.ok || !meResult.data?.result) {
      return jsonError("Telegram getMe failed", 500, {
        telegramStatus: meResult.status,
        telegramResponse: meResult.data,
        token: tokenCheck.masked,
      });
    }

    const bot = meResult.data.result;
    const webhook = webhookResult.ok ? webhookResult.data?.result ?? null : null;
    const readiness = buildReadiness(bot, webhook);

    return NextResponse.json({
      ok: true,
      source: "telegram",
      route: "/api/social/telegram/me",
      mode: "bot_diagnostics",
      token: {
        present: true,
        validFormat: tokenCheck.valid,
        masked: tokenCheck.masked,
      },
      bot: {
        id: bot.id,
        is_bot: bot.is_bot,
        first_name: bot.first_name,
        username: bot.username,
        bot_url: bot.username ? `https://t.me/${bot.username}` : null,
        can_join_groups: bot.can_join_groups ?? null,
        can_read_all_group_messages: bot.can_read_all_group_messages ?? null,
        supports_inline_queries: bot.supports_inline_queries ?? null,
      },
      webhook: webhook
        ? {
            url: webhook.url || null,
            has_custom_certificate: webhook.has_custom_certificate,
            pending_update_count: webhook.pending_update_count,
            ip_address: webhook.ip_address ?? null,
            last_error_date: webhook.last_error_date ?? null,
            last_error_message: webhook.last_error_message ?? null,
            max_connections: webhook.max_connections ?? null,
            allowed_updates: webhook.allowed_updates ?? null,
          }
        : {
            url: null,
            pending_update_count: null,
            note: webhookResult.ok
              ? "No webhook info returned."
              : "Could not fetch webhook info.",
          },
      readiness,
      plannedEngine: {
        target: "Autoaffi Social Lead Engine",
        platforms: ["youtube", "telegram", "mlgs"],
        storage: "lead_signals",
        sourceBank: "global_social_lead_sources",
        exclusivity: "lead_signal_claims",
        statusFlow: ["new", "saved", "contacted", "replied", "won", "dismissed"],
      },
    });
  } catch (error) {
    console.error("[telegram-me-route]", error);

    return jsonError(
      "Telegram bot diagnostics failed",
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}