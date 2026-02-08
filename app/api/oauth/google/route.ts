// app/api/oauth/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const stateObj = { userId, platform: "youtube", ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT!,
    response_type: "code",
    scope: "openid profile email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}