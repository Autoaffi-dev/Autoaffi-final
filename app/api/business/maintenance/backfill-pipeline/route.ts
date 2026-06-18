import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { scoreTarget } from "@/lib/business/scoring";
import { recommendContactStrategy } from "@/lib/business/contactStrategy";
import type { NormalizedBusinessTarget } from "@/lib/business/types";

export const runtime = "nodejs";

type PipelineRow = {
  id: string;
  user_id: string;
  target_id: string;
  status: string;
};

type TargetRow = {
  id: string;
  source: "places" | "registry";
  source_id: string;
  name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  rating: number | null;
  size_hint: "SMALL" | "MID" | "LARGE" | null;
};

function toOptionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
  return value ?? undefined;
}

function toOptionalSizeHint(
  value: "SMALL" | "MID" | "LARGE" | null | undefined
): "SMALL" | "MID" | "LARGE" | undefined {
  return value ?? undefined;
}

function toNormalizedTarget(target: TargetRow): NormalizedBusinessTarget {
  return {
    source: target.source,
    sourceId: target.source_id,
    name: target.name,
    website: toOptionalString(target.website),
    domain: toOptionalString(target.domain),
    phone: toOptionalString(target.phone),
    country: toOptionalString(target.country),
    city: toOptionalString(target.city),
    category: toOptionalString(target.category),
    rating: toOptionalNumber(target.rating),
    sizeHint: toOptionalSizeHint(target.size_hint),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(500, Math.max(1, Number(body?.limit ?? 100)));
    const onlyEmpty = body?.onlyEmpty !== false; // default true

    const supabase = getSupabaseAdmin();

    // 1) Load pipeline rows
    let pipelineQuery = supabase
      .from("business_pipeline")
      .select("id, user_id, target_id, status")
      .limit(limit);

    const { data: pipelineRows, error: pipelineError } = await pipelineQuery;

    if (pipelineError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load business_pipeline rows",
          details: pipelineError.message,
        },
        { status: 500 }
      );
    }

    const rows = (pipelineRows ?? []) as PipelineRow[];

    let scanned = 0;
    let updated = 0;
    let skipped = 0;

    const items: Array<{
      pipelineId: string;
      targetId: string;
      action: "updated" | "skipped";
      reason: string;
      score?: number;
      contactStrategy?: string;
    }> = [];

    for (const row of rows) {
      scanned += 1;

      // 2) Load full pipeline row to inspect current values
      const { data: fullPipeline, error: fullPipelineError } = await supabase
        .from("business_pipeline")
        .select("id, score, why, contact_strategy, target_id")
        .eq("id", row.id)
        .maybeSingle();

      if (fullPipelineError || !fullPipeline) {
        skipped += 1;
        items.push({
          pipelineId: row.id,
          targetId: row.target_id,
          action: "skipped",
          reason: "pipeline_row_missing",
        });
        continue;
      }

      const currentScore = Number(fullPipeline.score ?? 0);
      const currentWhy = Array.isArray(fullPipeline.why) ? fullPipeline.why : [];
      const currentContactStrategy =
        typeof fullPipeline.contact_strategy === "string"
          ? fullPipeline.contact_strategy.trim()
          : "";

      if (
        onlyEmpty &&
        currentScore > 0 &&
        currentWhy.length > 0 &&
        currentContactStrategy &&
        currentContactStrategy !== "safe_contact"
      ) {
        skipped += 1;
        items.push({
          pipelineId: row.id,
          targetId: row.target_id,
          action: "skipped",
          reason: "already_enriched",
        });
        continue;
      }

      // 3) Load target
      const { data: targetRow, error: targetError } = await supabase
        .from("business_targets")
        .select(
          "id, source, source_id, name, website, domain, phone, country, city, category, rating, size_hint"
        )
        .eq("id", row.target_id)
        .maybeSingle();

      if (targetError || !targetRow) {
        skipped += 1;
        items.push({
          pipelineId: row.id,
          targetId: row.target_id,
          action: "skipped",
          reason: "target_missing",
        });
        continue;
      }

      const normalizedTarget = toNormalizedTarget(targetRow as TargetRow);
      const scored = scoreTarget(normalizedTarget);
      const contactStrategy = recommendContactStrategy(normalizedTarget, scored.status);

      const { error: updateError } = await supabase
        .from("business_pipeline")
        .update({
          score: scored.score,
          why: scored.why,
          contact_strategy: contactStrategy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        skipped += 1;
        items.push({
          pipelineId: row.id,
          targetId: row.target_id,
          action: "skipped",
          reason: `update_failed: ${updateError.message}`,
        });
        continue;
      }

      updated += 1;
      items.push({
        pipelineId: row.id,
        targetId: row.target_id,
        action: "updated",
        reason: "pipeline_backfilled",
        score: scored.score,
        contactStrategy,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      maintenance: "backfill-pipeline",
      result: {
        scanned,
        updated,
        skipped,
        onlyEmpty,
        items,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Pipeline backfill failed",
        details: err?.message ?? null,
      },
      { status: 500 }
    );
  }
}