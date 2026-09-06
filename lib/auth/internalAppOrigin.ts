import { isLocalhostHost } from "./canonicalUserId";

/**
 * Trusted origin for same-origin Autoaffi internal fetch only.
 * Production destinations must never come from Host, X-Forwarded-Host, or Origin.
 */
export const INTERNAL_ORIGIN_NOT_CONFIGURED = "INTERNAL_ORIGIN_NOT_CONFIGURED";

export const TRUSTED_INTERNAL_ORIGIN_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BASE_URL",
  "APP_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

export type TrustedInternalOriginOpts = {
  nodeEnv?: string | null;
  env?: NodeJS.Dict<string | undefined>;
};

function readEnv(
  env: NodeJS.Dict<string | undefined> | undefined,
  key: string
): string {
  const source = env ?? process.env;
  return String(source[key] || "").trim();
}

function normalizeConfiguredOrigin(raw: string): string | null {
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

function requestUrlOriginIfLocalhost(requestUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (!isLocalhostHost(parsed.hostname)) {
    return null;
  }

  return parsed.origin;
}

/**
 * Resolve the destination origin for authenticated same-origin internal fetches.
 *
 * Production: first valid configured HTTP/HTTPS origin from trusted env keys.
 * Non-production: configured origin if present, else request URL origin when
 * the hostname is exactly localhost or 127.0.0.1.
 *
 * Returns null when no trusted origin exists (fail closed).
 */
export function resolveTrustedInternalOrigin(
  req: Pick<Request, "url">,
  opts?: TrustedInternalOriginOpts
): string | null {
  const env = opts?.env;
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV;

  for (const key of TRUSTED_INTERNAL_ORIGIN_ENV_KEYS) {
    const origin = normalizeConfiguredOrigin(readEnv(env, key));
    if (origin) return origin;
  }

  if (nodeEnv !== "production") {
    return requestUrlOriginIfLocalhost(req.url);
  }

  return null;
}

export function requireTrustedInternalOrigin(
  req: Pick<Request, "url">,
  opts?: TrustedInternalOriginOpts
): string {
  const origin = resolveTrustedInternalOrigin(req, opts);
  if (!origin) {
    throw new Error(INTERNAL_ORIGIN_NOT_CONFIGURED);
  }
  return origin;
}
