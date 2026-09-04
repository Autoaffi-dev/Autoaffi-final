import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

/**
 * GDPR data deletion placeholder.
 *
 * Phase 1A: fail closed. Body/query userId is ignored. No user data is deleted.
 * Real deletion behavior is deferred to Phase 1B / launch review.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = String((session as { user?: { id?: string } } | null)?.user?.id || "").trim();

  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  return res.status(403).json({
    error: "NOT_IMPLEMENTED",
    message:
      "Data deletion is an obsolete placeholder. No data was deleted. Deferred to Phase 1B/launch review.",
  });
}
