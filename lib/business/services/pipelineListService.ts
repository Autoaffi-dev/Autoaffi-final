import { getSupabaseAdmin } from "@/lib/supabase/server";

type PipelineTargetRow = {
  id: string;
  source: string | null;
  source_id: string | null;
  name: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  domain: string | null;
  size_hint: string | null;
};

export type PipelineListItem = {
  id: string;
  status: string | null;
  score: number;
  why: string[];
  contact_strategy: string | null;
  created_at: string | null;
  updated_at: string | null;
  business_targets: PipelineTargetRow | null;
};

function normalizeLimit(limit?: number): number {
  const n = Number(limit ?? 50);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(10, Math.round(n)));
}

function normalizeScore(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeWhy(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

export async function listPipeline(
  userId: string,
  limit = 50
): Promise<PipelineListItem[]> {
  const supabase = getSupabaseAdmin();
  const safeLimit = normalizeLimit(limit);

  const { data, error } = await supabase
    .from("business_pipeline")
    .select(`
      id,
      status,
      score,
      why,
      contact_strategy,
      created_at,
      updated_at,
      business_targets:target_id (
        id,
        source,
        source_id,
        name,
        country,
        city,
        category,
        website,
        phone,
        rating,
        domain,
        size_hint
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to load pipeline list: ${error.message}`);
  }

  const rows = (data ?? []) as any[];

  return rows.map((row): PipelineListItem => ({
    id: String(row?.id ?? ""),
    status: typeof row?.status === "string" ? row.status : null,
    score: normalizeScore(row?.score),
    why: normalizeWhy(row?.why),
    contact_strategy:
      typeof row?.contact_strategy === "string" ? row.contact_strategy : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
    business_targets: row?.business_targets
      ? {
          id: String(row.business_targets.id ?? ""),
          source:
            typeof row.business_targets.source === "string"
              ? row.business_targets.source
              : null,
          source_id:
            typeof row.business_targets.source_id === "string"
              ? row.business_targets.source_id
              : null,
          name:
            typeof row.business_targets.name === "string"
              ? row.business_targets.name
              : null,
          country:
            typeof row.business_targets.country === "string"
              ? row.business_targets.country
              : null,
          city:
            typeof row.business_targets.city === "string"
              ? row.business_targets.city
              : null,
          category:
            typeof row.business_targets.category === "string"
              ? row.business_targets.category
              : null,
          website:
            typeof row.business_targets.website === "string"
              ? row.business_targets.website
              : null,
          phone:
            typeof row.business_targets.phone === "string"
              ? row.business_targets.phone
              : null,
          rating:
            typeof row.business_targets.rating === "number" &&
            Number.isFinite(row.business_targets.rating)
              ? row.business_targets.rating
              : null,
          domain:
            typeof row.business_targets.domain === "string"
              ? row.business_targets.domain
              : null,
          size_hint:
            typeof row.business_targets.size_hint === "string"
              ? row.business_targets.size_hint
              : null,
        }
      : null,
  }));
}