import { NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/business/services/businessFinderService";
import { BusinessSearchParams } from "@/lib/business/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BusinessSearchParams>;

    if (!body?.keyword || typeof body.keyword !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing required field: keyword" },
        { status: 400 }
      );
    }

    const params: BusinessSearchParams = {
      mode: body.mode === "company" ? "company" : "local",
      keyword: body.keyword.trim(),
      limit: body.limit ?? 20,

      country: body.country,
      city: body.city,
      radiusKm: body.radiusKm,

      requireWebsite: !!body.requireWebsite,
      requirePhone: !!body.requirePhone,
      requireContactForm: !!body.requireContactForm,
    };

    const data = await searchBusinesses(params);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err?.message ?? null },
      { status: 400 }
    );
  }
}