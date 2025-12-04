import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect("/login?error=missing_code");

  const tokenRes = await fetch("https://graph.facebook.com/v20.0/oauth/access_token?" +
    new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID!,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
      redirect_uri: process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT!,
      code,
    })
  );
  const token = await tokenRes.json();
  if (!token.access_token) return NextResponse.redirect("/login?error=token_failed");

  // Spara token i session/db
  // TODO: connect to Supabase or Prisma here
  return NextResponse.redirect("/dashboard");
}