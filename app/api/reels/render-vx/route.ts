import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ensures FormData + streams work

export async function POST(req: Request) {
  try {
    // Read multipart FormData
    const formData = await req.formData();

    console.log("🔥 [RENDER-VX] Incoming payload keys:", Array.from(formData.keys()));

    // -------------------------------------------------
    // REQUIRED FIELDS (FIXED)
    // -------------------------------------------------
    const required = ["script", "duration", "mediaType", "realism", "voiceStyle"];
    for (const r of required) {
      if (!formData.get(r)) {
        return NextResponse.json(
          { error: `Missing required field: ${r}` },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------
    // FORWARD TO WORKER
    // -------------------------------------------------
    const WORKER_URL = process.env.RENDER_WORKER_URL;
    if (!WORKER_URL) {
      return NextResponse.json(
        { error: "Missing env RENDER_WORKER_URL" },
        { status: 500 }
      );
    }

    const workerResponse = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      body: formData,
    });

    console.log("📩 [RENDER-VX] Worker response status:", workerResponse.status);

    // Parse worker JSON
    let data: any = null;
    try {
      data = await workerResponse.json();
    } catch (err) {
      console.error("❌ Worker returned invalid JSON");
      return NextResponse.json(
        { error: "Worker returned invalid JSON." },
        { status: 500 }
      );
    }

    if (!workerResponse.ok) {
      console.error("❌ Worker Error:", data);
      return NextResponse.json(
        { error: data.error || "Render worker failed." },
        { status: 500 }
      );
    }

    console.log("✅ [RENDER-VX] Render success:", data);

    return NextResponse.json(
      {
        videoUrl: data.videoUrl,
        debug: data.debug || null,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("🔥 [RENDER-VX] Fatal Error", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error in render-vx route." },
      { status: 500 }
    );
  }
}