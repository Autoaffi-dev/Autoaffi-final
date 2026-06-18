import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/supabase/server";
import { syncRepliesForUser } from "@/lib/business/services/emailReplySyncService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);

    const result = await syncRepliesForUser({
      userId,
    });

    return NextResponse.json(
  {
    mode: "live",
    ...result,
  },
  { status: 200 }
);
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";

    const status =
      msg === "UNAUTHORIZED"
        ? 401
        : msg.includes("NO_ACTIVE_REPLY_SYNC_INBOX") ||
          msg.includes("NO_ACTIVE_REPLY_SYNC_TOKEN") ||
          msg.includes("REPLY_SYNC_PROVIDER_NOT_SUPPORTED") ||
          msg.includes("REPLY_SYNC_INBOX_EMAIL_MISSING")
        ? 400
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status }
    );
  }
}