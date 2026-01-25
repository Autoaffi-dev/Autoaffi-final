import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function listPipeline(userId: string, limit = 50) {
  const supabase = getSupabaseAdmin();

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
        id, source, source_id, name, country, city, category, website, phone, rating, domain, size_hint
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}