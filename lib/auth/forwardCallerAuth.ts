import { allowDevUserHeaders } from "./canonicalUserId";

const BLOCKED_FORWARD_HEADERS = new Set([
  "host",
  "x-forwarded-host",
  "origin",
  "x-autoaffi-user-id",
  "x-user-id",
  "authorization",
  "cookie",
]);

function isBlockedHeaderName(name: string): boolean {
  return BLOCKED_FORWARD_HEADERS.has(name.trim().toLowerCase());
}

/**
 * Copy authenticated caller context for same-origin Autoaffi internal fetch only.
 *
 * Production: session Cookie only, plus explicitly supplied safe extras
 * (for example Content-Type). Never forwards Host, X-Forwarded-Host, Origin,
 * identity headers, or Authorization.
 *
 * Developer UUID headers may be forwarded only under the Phase 1A rule:
 * NODE_ENV !== production AND Host is localhost / 127.0.0.1.
 *
 * This helper must not be used as a generic external-provider header copier.
 */
export function copyCallerAuthHeaders(
  req: Request,
  extra?: Record<string, string>,
  opts?: { nodeEnv?: string | null }
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (extra) {
    for (const [name, value] of Object.entries(extra)) {
      if (!name || value == null) continue;
      if (isBlockedHeaderName(name)) continue;
      headers[name] = value;
    }
  }

  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV;
  if (
    allowDevUserHeaders({
      nodeEnv,
      host: req.headers.get("host"),
    })
  ) {
    const autoaffi = req.headers.get("x-autoaffi-user-id");
    if (autoaffi) headers["x-autoaffi-user-id"] = autoaffi;

    const user = req.headers.get("x-user-id");
    if (user) headers["x-user-id"] = user;
  }

  return headers;
}
