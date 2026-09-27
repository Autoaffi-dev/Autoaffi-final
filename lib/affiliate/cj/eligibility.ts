import { isActiveCjContractStatus } from "./programTerms";
import { resolveSocialPromotionalProperty } from "./socialAccountProperty";
import type { CjSocialAccountSnapshot } from "./socialAccountProperty";
import type { CjPropertyMappingRow } from "./propertyMapping";

export const CJ_ELIGIBILITY_METHOD_SOCIAL_MEDIA = "social_media";

export type CjProgramReviewSnapshot = {
  advertiser_id: string;
  status: string;
  permitted_methods: string[];
};

export type CjEligibilityReason =
  | "CJ_PLATFORM_UNSUPPORTED"
  | "CJ_SOCIAL_ACCOUNT_NOT_CONNECTED"
  | "CJ_SOCIAL_HANDLE_MISSING"
  | "CJ_SOCIAL_ACCOUNT_OWNER_MISMATCH"
  | "CJ_PROPERTY_MISSING"
  | "CJ_PROPERTY_INACTIVE"
  | "CJ_CONTRACT_NOT_ACTIVE"
  | "CJ_PROGRAM_NOT_REVIEWED"
  | "CJ_PROGRAM_DISABLED"
  | "CJ_METHOD_NOT_ALLOWED";

export type CjEligibilityResult =
  | { ok: true; cjPid: string; method: string }
  | { ok: false; reason: CjEligibilityReason };

/**
 * Can this canonical user promote advertiser X from platform Y?
 * Network approval and an ACTIVE contract are not sufficient.
 * Autoaffi admin review must allow the promotional method.
 */
export function evaluateCjAdvertiserUse(args: {
  canonicalUserId: string;
  account: CjSocialAccountSnapshot | null;
  mapping: CjPropertyMappingRow | null;
  contractStatus: string | null;
  review: CjProgramReviewSnapshot | null;
  method?: string;
}): CjEligibilityResult {
  const method = String(args.method || CJ_ELIGIBILITY_METHOD_SOCIAL_MEDIA)
    .trim()
    .toLowerCase();

  const resolved = resolveSocialPromotionalProperty({
    canonicalUserId: args.canonicalUserId,
    account: args.account,
  });

  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason };
  }

  const mapping = args.mapping;
  if (
    !mapping ||
    mapping.user_id !== args.canonicalUserId ||
    mapping.platform !== resolved.platform ||
    mapping.social_account_identifier !== resolved.socialAccountIdentifier
  ) {
    return { ok: false, reason: "CJ_PROPERTY_MISSING" };
  }

  if (String(mapping.status || "").trim().toUpperCase() !== "ACTIVE" || !mapping.cj_pid) {
    return { ok: false, reason: "CJ_PROPERTY_INACTIVE" };
  }

  if (!isActiveCjContractStatus(args.contractStatus)) {
    return { ok: false, reason: "CJ_CONTRACT_NOT_ACTIVE" };
  }

  const review = args.review;
  if (!review) {
    return { ok: false, reason: "CJ_PROGRAM_NOT_REVIEWED" };
  }

  const reviewStatus = String(review.status || "").trim().toLowerCase();
  if (reviewStatus === "disabled") {
    return { ok: false, reason: "CJ_PROGRAM_DISABLED" };
  }
  if (reviewStatus !== "allowed") {
    return { ok: false, reason: "CJ_PROGRAM_NOT_REVIEWED" };
  }

  const methods = (review.permitted_methods || []).map((item) =>
    String(item || "").trim().toLowerCase()
  );
  if (!methods.includes(method)) {
    return { ok: false, reason: "CJ_METHOD_NOT_ALLOWED" };
  }

  return { ok: true, cjPid: mapping.cj_pid, method };
}
