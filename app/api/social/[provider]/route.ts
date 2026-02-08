import { NextRequest, NextResponse } from "next/server";
import {
  getSocialStatus,
  getSocialMetrics,
  SocialProvider,
} from "@/lib/integrations/socialClient";

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

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { searchParams } = new URL(req.url);

    const providerRaw = params?.provider;
    if (!providerRaw) {
      return NextResponse.json(
        { success: false, error: "Missing social provider" },
        { status: 400 }
      );
    }

    const key = providerRaw.toLowerCase() as SocialProvider;

    if (!validProviders.includes(key)) {
      return NextResponse.json(
        { success: false, error: `Unknown social provider: ${providerRaw}` },
        { status: 400 }
      );
    }

    const type = (searchParams.get("type") || "status").toLowerCase();
    const userId = searchParams.get("userId") || "demo-user";

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
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Social provider request failed" },
      { status: 500 }
    );
  }
}