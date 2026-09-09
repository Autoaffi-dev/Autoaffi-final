import { requireUserId } from "@/lib/auth/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  handleUserFunnelsDelete,
  handleUserFunnelsGet,
  handleUserFunnelsPost,
} from "@/lib/user-funnels/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deps() {
  return {
    requireUserId,
    supabase: getSupabaseAdmin(),
  };
}

export async function GET(req: Request) {
  return handleUserFunnelsGet(req, deps());
}

export async function POST(req: Request) {
  return handleUserFunnelsPost(req, deps());
}

export async function DELETE(req: Request) {
  return handleUserFunnelsDelete(req, deps());
}
