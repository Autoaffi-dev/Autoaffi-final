import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUserId } from "@/lib/supabase/server";
import { scoreTarget } from "@/lib/business/scoring";
import { recommendContactStrategy } from "@/lib/business/contactStrategy";
import type { NormalizedBusinessTarget } from "@/lib/business/types";

export const runtime = "nodejs";

type ClaimTargetInput = {
  source: "places" | "registry";
  sourceId: string;
  name: string;
  website?: string | null;
  domain?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  category?: string | null;
  rating?: number | null;
  sizeHint?: "SMALL" | "MID" | "LARGE" | null;
};

type ClaimBody = {
  target?: ClaimTargetInput;
  score?: number | null;
  why?: unknown;
  contactStrategy?: string | null;
  status?: "HOT" | "WARM" | "COLD" | null;

  // fallback stöd för platt body från nuvarande UI
  source?: "places" | "registry";
  sourceId?: string;
  name?: string;
  website?: string | null;
  domain?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  category?: string | null;
  rating?: number | null;
  sizeHint?: "SMALL" | "MID" | "LARGE" | null;
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

function isValidTarget(target: any): target is ClaimTargetInput {
  if (!target || typeof target !== "object") return false;
  if (target.source !== "places" && target.source !== "registry") return false;
  if (!target.sourceId || typeof target.sourceId !== "string") return false;
  if (!target.name || typeof target.name !== "string") return false;
  return true;
}

function normalizeScore(input: unknown): number {
  const n = Number(input ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeWhy(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeContactStrategy(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  return value || "safe_contact";
}

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

function toNormalizedTarget(target: ClaimTargetInput): NormalizedBusinessTarget {
  return {
    source: target.source,
    sourceId: target.sourceId,
    name: target.name,
    website: toOptionalString(target.website),
    domain: toOptionalString(target.domain),
    phone: toOptionalString(target.phone),
    country: toOptionalString(target.country),
    city: toOptionalString(target.city),
    category: toOptionalString(target.category),
    rating: toOptionalNumber(target.rating),
    sizeHint: toOptionalSizeHint(target.sizeHint),
  };
}

function extractTargetFromBody(body: ClaimBody): ClaimTargetInput | undefined {
  if (body?.target && isValidTarget(body.target)) {
    return body.target;
  }

  const flatTarget: ClaimTargetInput = {
    source: body.source as "places" | "registry",
    sourceId: typeof body.sourceId === "string" ? body.sourceId : "",
    name: typeof body.name === "string" ? body.name : "",
    website: body.website ?? null,
    domain: body.domain ?? null,
    phone: body.phone ?? null,
    country: body.country ?? null,
    city: body.city ?? null,
    category: body.category ?? null,
    rating: body.rating ?? null,
    sizeHint: body.sizeHint ?? null,
  };

  if (isValidTarget(flatTarget)) {
    return flatTarget;
  }

  return undefined;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);

    const body = (await req.json()) as ClaimBody;
    const target = extractTargetFromBody(body);

    if (!isValidTarget(target)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid required target fields" },
        { status: 400 }
      );
    }

    const normalizedTarget = toNormalizedTarget(target);
    const scored = scoreTarget(normalizedTarget);
    const derivedContactStrategy = recommendContactStrategy(normalizedTarget, scored.status);

    const fallbackScore = normalizeScore(body?.score);
    const fallbackWhy = normalizeWhy(body?.why);
    const fallbackContactStrategy = normalizeContactStrategy(body?.contactStrategy);

    const finalScore = scored.score > 0 ? scored.score : fallbackScore;
    const finalWhy = scored.why?.length ? scored.why : fallbackWhy;
    const finalContactStrategy =
      derivedContactStrategy || fallbackContactStrategy || "safe_contact";

    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    const { data: existingTarget, error: existingTargetError } = await supabase
      .from("business_targets")
      .select("id, source, source_id, name")
      .eq("source", target.source)
      .eq("source_id", target.sourceId)
      .maybeSingle();

    if (existingTargetError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check existing target",
          details: existingTargetError.message,
        },
        { status: 500 }
      );
    }

    let targetId: string | null = existingTarget?.id ?? null;

    if (!targetId) {
      const insertPayload = {
        source: target.source,
        source_id: target.sourceId,
        name: target.name,
        country: target.country ?? null,
        city: target.city ?? null,
        category: target.category ?? null,
        website: target.website ?? null,
        phone: target.phone ?? null,
        rating: target.rating ?? null,
        domain: target.domain ?? null,
        size_hint: target.sizeHint ?? null,
        updated_at: nowIso,
      };

      const { data: insertedTarget, error: insertTargetError } = await supabase
        .from("business_targets")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertTargetError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create target",
            details: insertTargetError.message,
          },
          { status: 500 }
        );
      }

      targetId = insertedTarget.id;
    } else {
      const { error: updateTargetError } = await supabase
        .from("business_targets")
        .update({
          name: target.name,
          country: target.country ?? null,
          city: target.city ?? null,
          category: target.category ?? null,
          website: target.website ?? null,
          phone: target.phone ?? null,
          rating: target.rating ?? null,
          domain: target.domain ?? null,
          size_hint: target.sizeHint ?? null,
          updated_at: nowIso,
        })
        .eq("id", targetId);

      if (updateTargetError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to update target metadata",
            details: updateTargetError.message,
          },
          { status: 500 }
        );
      }
    }

    if (!targetId) {
      return NextResponse.json(
        { ok: false, error: "Could not resolve target id" },
        { status: 500 }
      );
    }

    const { data: suppressionRows, error: suppressionError } = await supabase
      .from("business_suppressions")
      .select("type, reason, suppressed_at, suppressed_until")
      .eq("target_id", targetId);

    if (suppressionError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check suppression state",
          details: suppressionError.message,
        },
        { status: 500 }
      );
    }

    const activeSuppression = (suppressionRows ?? []).find((row: any) => {
      if (!row?.suppressed_until) return true;
      return new Date(row.suppressed_until).getTime() > Date.now();
    });

    if (activeSuppression) {
      return NextResponse.json(
        {
          ok: false,
          error: "Target is suppressed and cannot be claimed",
          suppression: {
            type: activeSuppression.type ?? null,
            reason: activeSuppression.reason ?? null,
            suppressedAt: activeSuppression.suppressed_at ?? null,
            suppressedUntil: activeSuppression.suppressed_until ?? null,
          },
        },
        { status: 409 }
      );
    }

    const { data: existingClaim, error: claimLookupError } = await supabase
      .from("business_claims")
      .select("target_id, claimed_by, claimed_at, last_activity_at")
      .eq("target_id", targetId)
      .maybeSingle();

    if (claimLookupError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check existing claim",
          details: claimLookupError.message,
        },
        { status: 500 }
      );
    }

    if (existingClaim && existingClaim.claimed_by && existingClaim.claimed_by !== userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Target is already claimed by another user",
          availability: "claimed",
          targetId,
        },
        { status: 409 }
      );
    }

    let claimMode: "created" | "existing" = "created";

    if (!existingClaim) {
      const { error: createClaimError } = await supabase
        .from("business_claims")
        .insert({
          target_id: targetId,
          claimed_by: userId,
          claimed_at: nowIso,
          last_activity_at: nowIso,
        });

      if (createClaimError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create claim",
            details: createClaimError.message,
          },
          { status: 500 }
        );
      }
    } else {
      claimMode = "existing";

      const { error: touchClaimError } = await supabase
        .from("business_claims")
        .update({
          last_activity_at: nowIso,
        })
        .eq("target_id", targetId)
        .eq("claimed_by", userId);

      if (touchClaimError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to refresh existing claim",
            details: touchClaimError.message,
          },
          { status: 500 }
        );
      }
    }

    const pipelinePayload = {
      user_id: userId,
      target_id: targetId,
      status: "CLAIMED",
      score: finalScore,
      why: finalWhy,
      contact_strategy: finalContactStrategy,
      updated_at: nowIso,
    };

    const { data: existingPipeline, error: existingPipelineError } = await supabase
      .from("business_pipeline")
      .select("id")
      .eq("user_id", userId)
      .eq("target_id", targetId)
      .maybeSingle();

    if (existingPipelineError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check pipeline row",
          details: existingPipelineError.message,
        },
        { status: 500 }
      );
    }

    if (!existingPipeline) {
      const { error: createPipelineError } = await supabase
        .from("business_pipeline")
        .insert(pipelinePayload);

      if (createPipelineError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to create pipeline row",
            details: createPipelineError.message,
          },
          { status: 500 }
        );
      }
    } else {
      const { error: updatePipelineError } = await supabase
        .from("business_pipeline")
        .update(pipelinePayload)
        .eq("id", existingPipeline.id);

      if (updatePipelineError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to update pipeline row",
            details: updatePipelineError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      claim: {
        targetId,
        status: "CLAIMED",
        claimMode,
      },
      pipeline: {
        status: "CLAIMED",
        score: finalScore,
        why: finalWhy,
        contactStrategy: finalContactStrategy,
        leadStatus: scored.status,
      },
      target: {
        id: targetId,
        source: target.source,
        sourceId: target.sourceId,
        name: target.name,
        website: target.website ?? null,
        country: target.country ?? null,
        city: target.city ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request",
        details: err?.message ?? null,
      },
      { status: 400 }
    );
  }
}