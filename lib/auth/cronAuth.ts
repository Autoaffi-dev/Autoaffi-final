import { timingSafeEqual } from "crypto";

function bearerToken(authorization: string | null): string | null {
  const raw = String(authorization || "").trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return match[1].trim();
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    if (left.length > 0) timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export type CronAuthInput = {
  headers: { get(name: string): string | null };
  url: string;
  nodeEnv?: string | null;
  cronSecret?: string | null;
};

/**
 * Fail-closed cron authentication.
 *
 * Production: Authorization Bearer CRON_SECRET, x-autoaffi-cron, or x-cron-secret.
 * Query-string secrets are rejected in production.
 * Missing CRON_SECRET always denies.
 */
export function isCronAuthorized(input: CronAuthInput): boolean {
  const expected = String(input.cronSecret ?? "").trim();
  if (!expected) return false;

  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  const headerCandidates = [
    bearerToken(input.headers.get("authorization")),
    input.headers.get("x-autoaffi-cron"),
    input.headers.get("x-cron-secret"),
  ];

  for (const candidate of headerCandidates) {
    const value = String(candidate || "").trim();
    if (value && timingSafeStringEqual(value, expected)) {
      return true;
    }
  }

  if (nodeEnv === "production") {
    return false;
  }

  let querySecret = "";
  try {
    const url = new URL(input.url);
    querySecret =
      url.searchParams.get("secret") ||
      url.searchParams.get("key") ||
      url.searchParams.get("token") ||
      "";
  } catch {
    querySecret = "";
  }

  return Boolean(querySecret) && timingSafeStringEqual(querySecret, expected);
}

export function isCronRequestAuthorized(req: Request): boolean {
  return isCronAuthorized({
    headers: req.headers,
    url: req.url,
    nodeEnv: process.env.NODE_ENV,
    cronSecret: process.env.CRON_SECRET,
  });
}
