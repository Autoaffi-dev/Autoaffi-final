import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

/**
 * Returns userId from NextAuth session (preferred).
 * Empty string means "not logged in".
 */
export async function getAuthUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id || "";
  return String(userId || "").trim();
}

/**
 * DEV safety:
 * Allow dev header only on localhost AND only when not production.
 */
export function allowDevHeader(req: Request) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const isLocalhost =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  return process.env.NODE_ENV !== "production" && isLocalhost;
}

/**
 * Unified user resolver:
 * 1) Try NextAuth session userId
 * 2) If missing AND local dev => allow x-autoaffi-user-id header
 * 3) Else throw UNAUTHORIZED
 */
export async function requireUserId(req: Request): Promise<string> {
  let userId = await getAuthUserId();

  if (!userId && allowDevHeader(req)) {
    userId = (req.headers.get("x-autoaffi-user-id") || "").trim();
  }

  if (!userId) {
    // Throwing lets routes decide response format; but simplest is to return 401 in route.
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}
