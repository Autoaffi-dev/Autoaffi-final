export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AutoaffiDistributor } from "@/lib/integrations/autoaffiDistributor";
import { isCronRequestAuthorized } from "@/lib/auth/cronAuth";

function pickRunnableMethod(instance: any) {
  if (typeof instance?.runFullCycle === "function") return instance.runFullCycle.bind(instance);
  if (typeof instance?.distributeRevenues === "function") return instance.distributeRevenues.bind(instance);
  return null;
}

export async function GET(request: Request) {
  console.log("🚀 [Autoaffi Cron] Start");

  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const distributor: any = new AutoaffiDistributor();
    const run = pickRunnableMethod(distributor);

    if (!run) {
      throw new Error(
        "No runnable method found on AutoaffiDistributor. Expected runFullCycle() or distributeRevenues()."
      );
    }

    await run();

    console.log("✅ [Autoaffi Cron] Done");
    return NextResponse.json({
      success: true,
      ran: run.name || "anonymous",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ [Autoaffi Cron] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
