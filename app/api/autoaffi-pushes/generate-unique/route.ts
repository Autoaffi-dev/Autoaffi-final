import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GeneratedPush, PushInput, PushDay } from "@/app/login/dashboard/autoaffi-pushes/types";
import { generatePush } from "@/lib/autoaffi-pushes/generatePush";

export const runtime = "nodejs";

type MemoryRow = {
  id: string;
  user_id: string;
  push_type: string;
  topic: string;
  day_number: number;
  signature: string;
  hook_family: string | null;
  body_family: string | null;
  cta_family: string | null;
  reply_family: string | null;
  image_prompt_family: string | null;
  video_script_family: string | null;
  created_at: string;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars for admin route.");
  }

  return createClient(url, serviceRole);
}

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function buildDaySignature(day: PushDay) {
  return JSON.stringify({
    hook: day.hook,
    body: day.body,
    cta: day.cta,
    commentReply: day.commentReply || "",
    imagePrompt: day.imagePrompt,
    videoScript: day.videoScript,
    hookFamily: (day as any).hookFamily || "",
    bodyFamily: (day as any).bodyFamily || "",
    ctaFamily: (day as any).ctaFamily || "",
    replyFamily: (day as any).commentReplyFamily || "",
    imagePromptFamily: (day as any).imagePromptFamily || "",
    videoScriptFamily: (day as any).videoScriptFamily || "",
  });
}

function isDayAllowed(day: PushDay, usedRows: MemoryRow[]) {
  const signature = buildDaySignature(day);

  const usedSignatures = new Set(usedRows.map((r) => r.signature));
  const usedHookFamilies = new Set(usedRows.map((r) => r.hook_family).filter(Boolean));
  const usedBodyFamilies = new Set(usedRows.map((r) => r.body_family).filter(Boolean));
  const usedCTAFamilies = new Set(usedRows.map((r) => r.cta_family).filter(Boolean));
  const usedReplyFamilies = new Set(usedRows.map((r) => r.reply_family).filter(Boolean));
  const usedImageFamilies = new Set(usedRows.map((r) => r.image_prompt_family).filter(Boolean));
  const usedVideoFamilies = new Set(usedRows.map((r) => r.video_script_family).filter(Boolean));

  if (usedSignatures.has(signature)) return false;
  if ((day as any).hookFamily && usedHookFamilies.has((day as any).hookFamily)) return false;
  if ((day as any).bodyFamily && usedBodyFamilies.has((day as any).bodyFamily)) return false;
  if ((day as any).ctaFamily && usedCTAFamilies.has((day as any).ctaFamily)) return false;
  if ((day as any).commentReplyFamily && usedReplyFamilies.has((day as any).commentReplyFamily)) return false;
  if ((day as any).imagePromptFamily && usedImageFamilies.has((day as any).imagePromptFamily)) return false;
  if ((day as any).videoScriptFamily && usedVideoFamilies.has((day as any).videoScriptFamily)) return false;

  return true;
}

function persistRows(userId: string, input: PushInput, push: GeneratedPush) {
  const topic = normalizeTopic(input.topic);

  return push.days.map((day) => ({
    user_id: userId,
    push_type: input.pushType,
    topic,
    day_number: day.dayNumber,
    signature: buildDaySignature(day),
    hook_family: (day as any).hookFamily || null,
    body_family: (day as any).bodyFamily || null,
    cta_family: (day as any).ctaFamily || null,
    reply_family: (day as any).commentReplyFamily || null,
    image_prompt_family: (day as any).imagePromptFamily || null,
    video_script_family: (day as any).videoScriptFamily || null,
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId || "").trim();
    const input = body?.input as PushInput | undefined;

    if (!userId || !input) {
      return NextResponse.json(
        { ok: false, error: "Missing userId or input." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();
    const topic = normalizeTopic(input.topic);

    const { data: memoryRows, error: memoryError } = await supabase
      .from("autoaffi_push_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("push_type", input.pushType)
      .eq("topic", topic)
      .order("created_at", { ascending: false })
      .limit(500);

    if (memoryError) {
      return NextResponse.json(
        { ok: false, error: memoryError.message },
        { status: 500 }
      );
    }

    const usedRows = (memoryRows || []) as MemoryRow[];

    let bestPush: GeneratedPush | null = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = generatePush(input);

      let score = 0;
      for (const day of candidate.days) {
        const usedForDay = usedRows.filter((row) => row.day_number === day.dayNumber);
        if (isDayAllowed(day, usedForDay)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPush = candidate;
      }

      if (score === candidate.days.length) {
        bestPush = candidate;
        break;
      }
    }

    if (!bestPush) {
      return NextResponse.json(
        { ok: false, error: "Failed to generate push." },
        { status: 500 }
      );
    }

    const rowsToInsert = persistRows(userId, input, bestPush);

    const { error: insertError } = await supabase
      .from("autoaffi_push_memory")
      .insert(rowsToInsert);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      push: bestPush,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown server error." },
      { status: 500 }
    );
  }
}