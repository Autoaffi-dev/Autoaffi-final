import { NextRequest, NextResponse } from "next/server";
import {
  getSocialStatus,
  getSocialMetrics,
  SocialProvider,
} from "@/lib/integrations/socialClient";

export async function GET(req: NextRequest) {
  try {
    const { pathname, searchParams } = new URL(req.url);

    // 👉 Läs provider direkt från URL istället för context.params
    const provider = pathname.split("/").pop();
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Missing social provider" },
        { status: 400 }
      );
    }

    const type = searchParams.get("type") || "status";
    const userId = searchParams.get("userId") || "demo-user";

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
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? "Social provider request failed",
      },
      { status: 500 }
    );
  }
}