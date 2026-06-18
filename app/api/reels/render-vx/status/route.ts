import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function pickJobId(url: URL): string {
  return (
    url.searchParams.get("jobId") ||
    url.searchParams.get("jobID") ||
    url.searchParams.get("renderJobId") ||
    ""
  ).trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = pickJobId(url);

    if (!jobId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing jobId",
        },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    const { data, error } = await db
      .from("render_jobs")
      .select("job_id, status, progress, video_url, error_message, created_at, updated_at")
      .eq("job_id", jobId)
      .maybeSingle();

    if (error) {
      console.error("[RENDER-VX STATUS] Supabase error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load render job status",
          jobId,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Render job not found",
          jobId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        jobId: data.job_id,
        status: data.status,
        progress:
          typeof data.progress === "number"
            ? data.progress
            : Number(data.progress ?? 0) || 0,
        videoUrl: data.video_url ?? null,
        error: data.error_message ?? null,
        createdAt: data.created_at ?? null,
        updatedAt: data.updated_at ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[RENDER-VX STATUS] Crash:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Render-VX status route failed",
      },
      { status: 500 }
    );
  }
}