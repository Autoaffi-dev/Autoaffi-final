import { NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/business/services/businessFinderService";
import type { BusinessSearchParams } from "@/lib/business/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BusinessSearchParams>;

    const params: BusinessSearchParams = {
      mode: body.mode === "company" ? "company" : "local",
      keyword: String(body.keyword ?? "").trim(),
      country: body.country ? String(body.country).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      radiusKm: typeof body.radiusKm === "number" ? body.radiusKm : undefined,
      limit: typeof body.limit === "number" ? body.limit : 20,

      requireWebsite: Boolean(body.requireWebsite),
      requirePhone: Boolean(body.requirePhone),
      requireContactForm: Boolean(body.requireContactForm),

      // Enrichment toggles
      enrichEmails: body.enrichEmails !== false,
      emailConcurrency: typeof body.emailConcurrency === "number" ? body.emailConcurrency : 4,
      emailTimeoutMs: typeof body.emailTimeoutMs === "number" ? body.emailTimeoutMs : 6000,
    };

    if (!params.keyword) {
      return NextResponse.json({ ok: false, error: "keyword is required" }, { status: 400 });
    }

    // ✅ Coming soon: Company/Registry mode (no token cost now)
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
            "Company/Registry Finder is Coming Soon. Local Finder (Google Places) is live and already gives website/phone + email enrichment.",
        },
      });
    }

    // ✅ Live: Local mode
    const result = await searchBusinesses(params);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Invalid request", details: err?.message ?? null },
      { status: 400 }
    );
  }
}