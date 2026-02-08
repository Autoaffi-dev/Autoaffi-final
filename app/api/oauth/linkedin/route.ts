// app/api/oauth/linkedin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const stateObj = { userId, platform: "linkedin", ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateObj), "utf8").toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_LINKEDIN_REDIRECT!,
    scope: "r_liteprofile r_emailaddress w_member_social",
    state,
  });

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
}