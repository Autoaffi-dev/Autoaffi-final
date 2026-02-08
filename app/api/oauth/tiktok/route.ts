// app/api/oauth/tiktok/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const stateObj = {
    userId,
    platform: "tiktok",
    ts: Date.now(),
  };

  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  // TikTok V2 authorize endpoint
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_TIKTOK_REDIRECT!,
    response_type: "code",
    scope: "user.info.basic,video.list",
    state,
  });

  return NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  );
}