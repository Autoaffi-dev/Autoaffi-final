import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect("/login?error=missing_code");

  const res = await fetch("https://open-api.tiktok.com/oauth/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_ID!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.NEXT_PUBLIC_TIKTOK_REDIRECT!,
    }),
  });
  const data = await res.json();
  if (!data.access_token) return NextResponse.redirect("/login?error=token_failed");

  return NextResponse.redirect("/dashboard");
}