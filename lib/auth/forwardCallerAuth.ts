/**
 * Copy caller auth onto same-origin internal fetches.
 * Session cookies (and localhost UUID headers) must be forwarded so
 * nested cost routes can call requireUserId without becoming public.
 */
export function copyCallerAuthHeaders(
  req: Request,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };

  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  const autoaffi = req.headers.get("x-autoaffi-user-id");
  if (autoaffi) headers["x-autoaffi-user-id"] = autoaffi;

  const user = req.headers.get("x-user-id");
  if (user) headers["x-user-id"] = user;

  const host = req.headers.get("host");
  if (host) headers.host = host;

  return headers;
}
