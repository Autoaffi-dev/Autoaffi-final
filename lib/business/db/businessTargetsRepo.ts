import { getSupabaseAdmin } from "@/lib/supabase/server";
import { NormalizedBusinessTarget } from "../types";

export type TargetRow = {
  id: string;
  source: string;
  source_id: string;
};

export async function upsertTargets(
  targets: NormalizedBusinessTarget[]
): Promise<TargetRow[]> {
  const supabase = getSupabaseAdmin();
  if (!targets.length) return [];

  const payload = targets.map((t) => ({
    source: t.source,
    source_id: t.sourceId,
    name: t.name,
    country: t.country ?? null,
    city: t.city ?? null,
    category: t.category ?? null,
    website: t.website ?? null,
    phone: t.phone ?? null,
    rating: t.rating ?? null,
    domain: t.domain ?? null,
    size_hint: t.sizeHint ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("business_targets")
    .upsert(payload, { onConflict: "source,source_id" })
    .select("id, source, source_id");

  if (error) throw error;
  return (data ?? []) as TargetRow[];
}

export async function getTargetIdBySource(
  source: string,
  sourceId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_targets")
    .select("id")
    .eq("source", source)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}