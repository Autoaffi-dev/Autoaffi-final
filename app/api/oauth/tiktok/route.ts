import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_TIKTOK_REDIRECT!,
    scope: "user.info.basic,video.list",
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  );
}