import { NextRequest, NextResponse } from "next/server";
import {
  getSocialStatus,
  getSocialMetrics,
  SocialProvider,
} from "@/lib/integrations/socialClient";

export async function GET(
  req: NextRequest,
  context: { params: { provider: string } }
) {
  const { provider } = context.params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "status";
  const userId = url.searchParams.get("userId") || "demo-user";

  const key = provider.toLowerCase() as SocialProvider;

  const validProviders: SocialProvider[] = [
    "tiktok",
    "instagram",
    "youtube",
    "linkedin",
    "facebook",
    "x",
    "pinterest",
    "metricool",
  ];

  if (!validProviders.includes(key)) {
    return NextResponse.json(
      { success: false, error: `Unknown social provider: ${provider}` },
      { status: 400 }
    );
  }

  if (type === "status") {
    const status = await getSocialStatus(key, userId);
    return NextResponse.json(
      { success: true, type: "status", data: status },
      { status: 200 }
    );
  }

  if (type === "metrics") {
    const metrics = await getSocialMetrics({ provider: key, userId });
    return NextResponse.json(
      { success: true, type: "metrics", data: metrics },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { success: false, error: `Unknown type: ${type}` },
    { status: 400 }
  );
}