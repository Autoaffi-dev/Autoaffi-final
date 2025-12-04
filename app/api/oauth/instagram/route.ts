import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT!,
    scope: "user_profile,user_media",
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://api.instagram.com/oauth/authorize?${params.toString()}`
  );
}