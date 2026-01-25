import { NextResponse } from "next/server";

/**
 * PipelineRunner maps VX 4.4 generation output into
 * a clean payload for the Render Worker.
 */
export async function runPipeline(fd: FormData) {
  try {
    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) throw new Error("Missing RENDER_WORKER_URL");

    const res = await fetch(`${workerUrl}/render`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      console.error("Worker error:", await res.text());
      throw new Error("Worker responded with an error.");
    }

    return await res.json();
  } catch (err) {
    console.error("PipelineRunner Error:", err);
    return { error: "PipelineRunner failed." };
  }
}