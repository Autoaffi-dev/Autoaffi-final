import { NextResponse } from "next/server";
import { requireUserId, UNAUTHORIZED_ERROR } from "@/lib/auth/server";

export function unauthorizedJson(extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", ...extra },
    { status: 401 }
  );
}

export async function requireUserIdOr401(
  req: Request
): Promise<{ userId: string } | { response: NextResponse }> {
  try {
    const userId = await requireUserId(req);
    return { userId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === UNAUTHORIZED_ERROR || msg === "UNAUTHORIZED") {
      return { response: unauthorizedJson() };
    }
    throw err;
  }
}
