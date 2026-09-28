import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CjProgramReviewSnapshot } from "./eligibility";
import type { CjPropertyMappingRow } from "./propertyMapping";
import { filterCjSearchItems } from "./searchGate";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";

export async function applyCjSearchGate<
  T extends { source?: string | null; merchant_id?: string | null }
>(canonicalUserId: string, items: T[]): Promise<T[]> {
  if (!items.some((item) => String(item.source || "").trim().toLowerCase() === "cj")) {
    return items;
  }

  const userId = String(canonicalUserId || "").trim();
  if (!userId) {
    return items.filter((item) => String(item.source || "").trim().toLowerCase() !== "cj");
  }

  try {
    const advertiserIds = [
      ...new Set(
        items
          .filter((item) => String(item.source || "").trim().toLowerCase() === "cj")
          .map((item) => String(item.merchant_id || "").trim())
          .filter(Boolean)
      ),
    ];

    const [accountRes, propertyRes, reviewRes] = await Promise.all([
      supabaseAdmin
        .from("user_social_accounts")
        .select("id,user_id,platform,status,username,meta")
        .eq("user_id", userId)
        .eq("platform", "instagram")
        .maybeSingle(),
      supabaseAdmin
        .from("cj_promotional_properties")
        .select(
          "id,user_id,platform,social_account_id,social_account_identifier,social_media_handle,cj_social_platform,cj_pid,property_type,status"
        )
        .eq("user_id", userId),
      advertiserIds.length
        ? supabaseAdmin
            .from("cj_program_reviews")
            .select("advertiser_id,status,permitted_methods,reviewed_by")
            .in("advertiser_id", advertiserIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (accountRes.error || propertyRes.error || reviewRes.error) {
      return items.filter((item) => String(item.source || "").trim().toLowerCase() !== "cj");
    }

    return filterCjSearchItems(items, {
      canonicalUserId: userId,
      account: (accountRes.data as CjSocialAccountSnapshot | null) ?? null,
      properties: (propertyRes.data as CjPropertyMappingRow[] | null) ?? [],
      reviews: (reviewRes.data as CjProgramReviewSnapshot[] | null) ?? [],
    });
  } catch {
    return items.filter((item) => String(item.source || "").trim().toLowerCase() !== "cj");
  }
}
