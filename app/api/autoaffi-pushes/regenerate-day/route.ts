import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PushInput, PushDay } from "@/app/login/dashboard/autoaffi-pushes/types";
import { generateUniqueDayVariant } from "@/lib/autoaffi-pushes/generatePush";

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

function getCTAKind(cta: string): "comment" | "save" | "follow" | "click" | "other" {
  const value = cta.toLowerCase();

  if (value.includes("comment")) return "comment";
  if (value.includes("save")) return "save";
  if (value.includes("follow")) return "follow";
  if (
    value.includes("click") ||
    value.includes("go deeper") ||
    value.includes("next step") ||
    value.includes("move on it") ||
    value.includes("ready")
  ) {
    return "click";
  }

  return "other";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = String(body?.userId || "").trim();
    const input = body?.input as PushInput | undefined;
    const dayNumber = Number(body?.dayNumber || 0);

    if (!userId || !input || !dayNumber) {
      return NextResponse.json(
        { ok: false, error: "Missing userId, input or dayNumber." },
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
      .eq("day_number", dayNumber)
      .order("created_at", { ascending: false })
      .limit(500);

    if (memoryError) {
      return NextResponse.json(
        { ok: false, error: memoryError.message },
        { status: 500 }
      );
    }

    const usedRows = (memoryRows || []) as MemoryRow[];
    const seenSignatures = usedRows.map((row) => row.signature);
    const seenCTAKinds = usedRows.map((row) => {
      const parsed = JSON.parse(row.signature);
      return getCTAKind(parsed.cta || "");
    });

    const shouldForceComment = !seenCTAKinds.includes("comment") && usedRows.length >= 2;

    let chosenDay: PushDay | null = null;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const candidate = generateUniqueDayVariant({
        input,
        dayNumber,
        seenSignatures,
        requireCommentCTA: shouldForceComment,
      });

      const signature = buildDaySignature(candidate);
      const alreadySeen = seenSignatures.includes(signature);

      if (!alreadySeen) {
        chosenDay = candidate;
        break;
      }
    }

    if (!chosenDay) {
      chosenDay = generateUniqueDayVariant({
        input,
        dayNumber,
        seenSignatures,
        requireCommentCTA: false,
      });
    }

    const rowToInsert = {
      user_id: userId,
      push_type: input.pushType,
      topic,
      day_number: dayNumber,
      signature: buildDaySignature(chosenDay),
      hook_family: (chosenDay as any).hookFamily || null,
      body_family: (chosenDay as any).bodyFamily || null,
      cta_family: (chosenDay as any).ctaFamily || null,
      reply_family: (chosenDay as any).commentReplyFamily || null,
      image_prompt_family: (chosenDay as any).imagePromptFamily || null,
      video_script_family: (chosenDay as any).videoScriptFamily || null,
    };

    const { error: insertError } = await supabase
      .from("autoaffi_push_memory")
      .insert(rowToInsert);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      day: chosenDay,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown server error." },
      { status: 500 }
    );
  }
}