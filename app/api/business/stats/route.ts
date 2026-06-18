import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PipelineStatRow = {
  id: string;
  status: string | null;
  score: number | null;
  created_at: string | null;
};

type TargetIdRow = {
  target_id: string | null;
};

type SuppressionRow = {
  target_id: string | null;
  type: string | null;
  suppressed_until: string | null;
};

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";

  if (!url) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function startOfTodayMs() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function normalizeScore(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function isActiveSuppression(row: SuppressionRow) {
  if (!row?.suppressed_until) return true;
  const until = new Date(row.suppressed_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);
    const supabase = getAdminClient();
    const todayStartMs = startOfTodayMs();

    const [pipelineRes, targetIdsRes] = await Promise.all([
      supabase
        .from("business_pipeline")
        .select("id, status, score, created_at")
        .eq("user_id", userId),

      supabase
        .from("business_pipeline")
        .select("target_id")
        .eq("user_id", userId),
    ]);

    if (pipelineRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load business pipeline stats",
          details: pipelineRes.error.message,
        },
        { status: 500 }
      );
    }

    if (targetIdsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load user target ids",
          details: targetIdsRes.error.message,
        },
        { status: 500 }
      );
    }

    const pipeline = (pipelineRes.data ?? []) as PipelineStatRow[];
    const targetIds = Array.from(
      new Set(
        ((targetIdsRes.data ?? []) as TargetIdRow[])
          .map((r) => r.target_id)
          .filter((v): v is string => typeof v === "string" && !!v)
      )
    );

    const claimed = pipeline.filter((r) => r.status === "CLAIMED").length;
    const suppressed = pipeline.filter((r) => r.status === "SUPPRESSED").length;
    const cooldown = pipeline.filter((r) => r.status === "COOLDOWN").length;
    const won = pipeline.filter((r) => r.status === "WON").length;

    const hot = pipeline.filter((r) => normalizeScore(r.score) >= 10).length;
    const warm = pipeline.filter((r) => {
      const s = normalizeScore(r.score);
      return s >= 6 && s <= 9;
    }).length;
    const cold = pipeline.filter((r) => normalizeScore(r.score) <= 5).length;

    const newLeadsToday = pipeline.filter((r) => {
      if (!r.created_at) return false;
      const createdMs = new Date(r.created_at).getTime();
      return Number.isFinite(createdMs) && createdMs >= todayStartMs;
    }).length;

    let suppressedHard = 0;
    let suppressedCooldown = 0;

    if (targetIds.length) {
      const { data: suppressionRows, error: suppressionError } = await supabase
        .from("business_suppressions")
        .select("target_id, type, suppressed_until")
        .in("target_id", targetIds);

      if (suppressionError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to load suppressions",
            details: suppressionError.message,
          },
          { status: 500 }
        );
      }

      const activeSuppressions = ((suppressionRows ?? []) as SuppressionRow[]).filter(
        isActiveSuppression
      );

      suppressedHard = activeSuppressions.filter((r) => r.type === "hard").length;
      suppressedCooldown = activeSuppressions.filter(
        (r) => r.type === "cooldown"
      ).length;
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      stats: {
        totalPipeline: pipeline.length,
        claimed,
        suppressed,
        cooldown,
        won,
        newLeadsToday,
        hot,
        warm,
        cold,
        suppressedHard,
        suppressedCooldown,
      },
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    const status = msg === "UNAUTHORIZED" ? 401 : 400;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status }
    );
  }
}