import { NormalizedBusinessTarget } from "../types";
import { getTargetIdBySource } from "../db/businessTargetsRepo";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlaceDetails } from "../providers/placesProvider";

/**
 * V1:
 * - För "places": försöker hämta detaljer via provider (stub -> null just nu)
 * - För "registry": V1 returnerar DB-raden (enrichment kommer senare)
 * - Returnerar alltid minst DB-data om target finns
 */
export async function getBusinessDetails(input: {
  source: "places" | "registry";
  sourceId: string;
}) {
  const supabase = getSupabaseAdmin();

  // 1) Hämta targetId i DB (måste finnas eftersom vi upsertar i search/claim)
  const targetId = await getTargetIdBySource(input.source, input.sourceId);
  if (!targetId) {
    return { found: false as const, targetId: null, target: null, providerDetails: null };
  }

  // 2) Hämta DB-raden (source of truth för V1)
  const { data: row, error } = await supabase
    .from("business_targets")
    .select("id, source, source_id, name, country, city, category, website, phone, rating, domain, size_hint")
    .eq("id", targetId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return { found: false as const, targetId, target: null, providerDetails: null };

  const target: NormalizedBusinessTarget = {
    source: row.source,
    sourceId: row.source_id,
    name: row.name,
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    category: row.category ?? undefined,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    rating: row.rating ?? undefined,
    domain: row.domain ?? undefined,
    sizeHint: row.size_hint ?? undefined,
  };

  // 3) Provider details (endast places i V1)
  let providerDetails: any = null;
  if (input.source === "places") {
    // stub just nu -> null, men när vi kopplar Places API kommer den börja returnera data
    providerDetails = await getPlaceDetails(input.sourceId);
  }

  return {
    found: true as const,
    targetId,
    target,
    providerDetails,
  };
}