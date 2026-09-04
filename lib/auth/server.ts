import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import {
  allowDevUserHeaders,
  requireCanonicalUserId,
  resolveCanonicalUserId,
  UNAUTHORIZED_ERROR,
} from "@/lib/auth/canonicalUserId";

/**
 * Returns userId from NextAuth session (preferred).
 * Empty string means "not logged in".
 *
 * Canonical value: session.user.id (Supabase Auth UUID).
 */
export async function getAuthUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session as { user?: { id?: string } } | null)?.user?.id || "";
  return String(userId || "").trim();
}

/**
 * DEV safety:
 * Allow developer UUID headers only on localhost AND only when not production.
 * Does not apply to Vercel Preview or any public Cloud host.
 */
export function allowDevHeader(req: Request) {
  return allowDevUserHeaders({
    nodeEnv: process.env.NODE_ENV,
    host: req.headers.get("host"),
  });
}

/**
 * Unified user resolver for normal logged-in Autoaffi user routes.
 *
 * 1) NextAuth session.user.id (canonical production identity)
 * 2) If missing AND local non-production localhost => UUID header
 *    x-autoaffi-user-id or x-user-id
 * 3) Else throw UNAUTHORIZED
 *
 * Does NOT accept Bearer tokens, NEXT_PUBLIC_DEV_USER_ID, or body/query userId.
 */
export async function requireUserId(req: Request): Promise<string> {
  const sessionUserId = await getAuthUserId();

  try {
    return requireCanonicalUserId({
      sessionUserId,
      headers: req.headers,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch {
    throw new Error(UNAUTHORIZED_ERROR);
  }
}

export async function tryRequireUserId(req: Request): Promise<string | null> {
  const sessionUserId = await getAuthUserId();
  return resolveCanonicalUserId({
    sessionUserId,
    headers: req.headers,
    nodeEnv: process.env.NODE_ENV,
  });
}

export { resolveCanonicalUserId, requireCanonicalUserId, UNAUTHORIZED_ERROR };
