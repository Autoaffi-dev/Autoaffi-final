import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readCjServerConfig } from "./config";
import type { CjProgramReviewSnapshot } from "./eligibility";
import { parseCjIndexedProduct } from "./productIdentity";
import { getCJAdvertiserContract } from "./programTerms";
import type { CjPropertyMappingRow } from "./propertyMapping";
import {
  CjOfferDestinationError,
  resolveCjOfferDestination,
  type CjOfferIndexRow,
} from "./resolveCjOfferDestination";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";

export async function resolveStoredCjOfferDestination(args: {
  canonicalUserId: string;
  indexRow: CjOfferIndexRow;
  promotionContext: string;
  promotionPlatform?: string | null;
  clientAdvertiserId?: unknown;
  clientPid?: unknown;
  clientAid?: unknown;
  clientDestination?: unknown;
  clientSid?: unknown;
}) {
  const userId = String(args.canonicalUserId || "").trim();
  const [accountRes, propertyRes] = await Promise.all([
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
  ]);

  if (accountRes.error || propertyRes.error) {
    throw new CjOfferDestinationError("CJ_PROPERTY_STORE_FAILED");
  }

  const identity = parseCjIndexedProduct(args.indexRow);
  let review: CjProgramReviewSnapshot | null = null;

  if (identity) {
    const reviewRes = await supabaseAdmin
      .from("cj_program_reviews")
      .select("advertiser_id,status,permitted_methods,reviewed_by")
      .eq("advertiser_id", identity.advertiserId)
      .maybeSingle();
    if (reviewRes.error) {
      throw new CjOfferDestinationError("CJ_PROGRAM_NOT_REVIEWED");
    }
    review = (reviewRes.data as CjProgramReviewSnapshot | null) ?? null;
  }

  const contract = identity
    ? await getCJAdvertiserContract({
        ...readCjServerConfig(),
        advertiserId: identity.advertiserId,
      })
    : null;

  return resolveCjOfferDestination({
    canonicalUserId: userId,
    indexRow: args.indexRow,
    promotionContext: args.promotionContext,
    promotionPlatform: args.promotionPlatform,
    account: (accountRes.data as CjSocialAccountSnapshot | null) ?? null,
    properties: (propertyRes.data as CjPropertyMappingRow[] | null) ?? [],
    contract,
    review,
    clientAdvertiserId: args.clientAdvertiserId,
    clientPid: args.clientPid,
    clientAid: args.clientAid,
    clientDestination: args.clientDestination,
    clientSid: args.clientSid,
  });
}
