import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT!,
    scope: "public_profile,email",
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`
  );
}