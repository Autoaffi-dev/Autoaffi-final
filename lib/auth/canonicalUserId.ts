/**
 * Canonical Autoaffi user identity (Phase 1A).
 *
 * Production identity for normal logged-in user routes:
 *   NextAuth session → session.user.id → Supabase Auth UUID
 *
 * Never used as production authorization:
 *   x-autoaffi-user-id, x-user-id, NEXT_PUBLIC_DEV_USER_ID,
 *   body/query userId, or any other client-claimed UUID.
 *
 * Local development exception (headers only):
 *   NODE_ENV !== "production" AND Host is localhost / 127.0.0.1
 *
 * This module has no NextAuth / Supabase imports so it stays
 * unit-testable without creating a second identity system.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UNAUTHORIZED_ERROR = "UNAUTHORIZED";

export type HeaderLike = {
  get(name: string): string | null;
};

export function sanitizeId(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
}

export function isUuid(value: string | null | undefined): boolean {
  const cleaned = sanitizeId(value);
  if (!cleaned) return false;
  return UUID_RE.test(cleaned);
}

export function isLocalhostHost(hostHeader: string | null | undefined): boolean {
  const host = String(hostHeader || "").toLowerCase().trim();
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function allowDevUserHeaders(opts: {
  nodeEnv?: string | null;
  host?: string | null;
}): boolean {
  return opts.nodeEnv !== "production" && isLocalhostHost(opts.host);
}

/**
 * Developer UUID headers. Read only after allowDevUserHeaders() is true.
 * Never used when a session identity already exists.
 */
export function readDeveloperUserHeader(headers: HeaderLike): string {
  const autoaffi = sanitizeId(headers.get("x-autoaffi-user-id"));
  if (autoaffi) return autoaffi;
  return sanitizeId(headers.get("x-user-id"));
}

export type CanonicalUserIdInput = {
  sessionUserId?: string | null;
  headers: HeaderLike;
  nodeEnv?: string | null;
  /** Optional override; defaults to headers.get("host") */
  host?: string | null;
  /**
   * Client-claimed identity (body/query userId). MUST be ignored.
   * Accepted only so tests can prove it never becomes authorization.
   */
  clientClaimedUserId?: string | null;
};

export function resolveCanonicalUserId(input: CanonicalUserIdInput): string | null {
  const sessionUserId = sanitizeId(input.sessionUserId);

  if (sessionUserId) {
    return sessionUserId;
  }

  // Explicitly unused: client claims never authorize.
  void input.clientClaimedUserId;

  const host = input.host ?? input.headers.get("host");
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  if (!allowDevUserHeaders({ nodeEnv, host })) {
    return null;
  }

  const headerId = readDeveloperUserHeader(input.headers);
  if (headerId && isUuid(headerId)) {
    return headerId;
  }

  return null;
}

export function requireCanonicalUserId(input: CanonicalUserIdInput): string {
  const userId = resolveCanonicalUserId(input);
  if (!userId) {
    throw new Error(UNAUTHORIZED_ERROR);
  }
  return userId;
}
