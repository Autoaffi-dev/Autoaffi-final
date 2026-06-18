import { NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/business/services/businessFinderService";
import { requireUserId } from "@/lib/supabase/server";
import type { BusinessSearchParams } from "@/lib/business/types";

export const runtime = "nodejs";

function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function toLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 10;
  return Math.min(100, Math.max(1, Math.round(value)));
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);
    const body = (await req.json()) as Partial<BusinessSearchParams>;

    const params: BusinessSearchParams = {
      mode: body.mode === "company" ? "company" : "local",
      keyword: String(body.keyword ?? "").trim(),
      country: toOptionalTrimmedString(body.country),
      city: toOptionalTrimmedString(body.city),
      radiusKm: toOptionalNumber(body.radiusKm),
      limit: toLimit(body.limit),

      requireWebsite: toBoolean(body.requireWebsite),
      requirePhone: toBoolean(body.requirePhone),
      requireContactForm: toBoolean(body.requireContactForm),

      // Production: always resolved from authenticated user identity
      userId,

      enrichEmails: body.enrichEmails !== false,
      emailConcurrency:
        typeof body.emailConcurrency === "number" &&
        Number.isFinite(body.emailConcurrency)
          ? Math.min(10, Math.max(1, Math.round(body.emailConcurrency)))
          : 4,
      emailTimeoutMs:
        typeof body.emailTimeoutMs === "number" &&
        Number.isFinite(body.emailTimeoutMs)
          ? Math.min(15000, Math.max(1000, Math.round(body.emailTimeoutMs)))
          : 6000,
    };

    if (!params.keyword) {
      return NextResponse.json(
        { ok: false, error: "keyword is required" },
        { status: 400 }
      );
    }

    if (params.mode === "company") {
      return NextResponse.json({
        ok: true,
        mode: "company",
        params,
        results: [],
        meta: {
          returned: 0,
          comingSoon: true,
          note:
            "Company/Registry Finder is Coming Soon. Local Finder (Google Places) is live and already gives website/phone plus email enrichment.",
        },
      });
    }

    const result = await searchBusinesses(params);
    return NextResponse.json(result);
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