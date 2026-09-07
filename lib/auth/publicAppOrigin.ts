import { isLocalhostHost } from "./canonicalUserId";

/**
 * Trusted origin for customer-facing Autoaffi public URLs only
 * (Recurring Autoaffi referral links).
 *
 * Not for authenticated internal fetches. Do not use request Host,
 * X-Forwarded-Host, Origin, request.url, or VERCEL_URL.
 */
export const PUBLIC_ORIGIN_NOT_CONFIGURED = "PUBLIC_ORIGIN_NOT_CONFIGURED";

export const TRUSTED_PUBLIC_ORIGIN_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "QR_PUBLIC_BASE_URL",
] as const;

export type PublicAppOriginOpts = {
  nodeEnv?: string | null;
  env?: NodeJS.Dict<string | undefined>;
};

const LOCAL_DEV_ORIGIN = "http://localhost:3000";

function readEnv(
  env: NodeJS.Dict<string | undefined> | undefined,
  key: string
): string {
  const source = env ?? process.env;
  return String(source[key] || "").trim();
}

function parseHttpOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return parsed.origin;
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    return isLocalhostHost(new URL(origin).hostname);
  } catch {
    return true;
  }
}

/**
 * Resolve the canonical public Autoaffi origin for customer-facing Recurring URLs.
 *
 * Production: first valid configured HTTP/HTTPS origin that is not localhost.
 * Non-production: configured origin if valid, else http://localhost:3000.
 *
 * Returns null when production has no trusted public origin (fail closed).
 */
export function resolvePublicAppOrigin(opts?: PublicAppOriginOpts): string | null {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === "production";

  for (const key of TRUSTED_PUBLIC_ORIGIN_ENV_KEYS) {
    const origin = parseHttpOrigin(readEnv(opts?.env, key));
    if (!origin) continue;
    if (isProduction && isLocalhostOrigin(origin)) continue;
    return origin;
  }

  if (!isProduction) {
    return LOCAL_DEV_ORIGIN;
  }

  return null;
}

export function requirePublicAppOrigin(opts?: PublicAppOriginOpts): string {
  const origin = resolvePublicAppOrigin(opts);
  if (!origin) {
    throw new Error(PUBLIC_ORIGIN_NOT_CONFIGURED);
  }
  return origin;
}
