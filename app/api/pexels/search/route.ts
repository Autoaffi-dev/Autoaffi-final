import { NextRequest, NextResponse } from "next/server";
import { requireUserIdOr401 } from "@/lib/auth/routeAuth";

export async function POST(req: NextRequest) {
  const auth = await requireUserIdOr401(req);
  if ("response" in auth) return auth.response;
  void auth.userId;

  const { query, userId: bodyUserId } = await req.json();
  void bodyUserId;

  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`, {
    headers: {
      Authorization: process.env.PEXELS_API_KEY!,
    },
  });

  const data = await res.json();
  return NextResponse.json(data);
}