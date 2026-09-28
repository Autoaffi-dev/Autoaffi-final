/**
 * Customer copy for CJ save and search failures.
 * Internal codes stay on the server.
 */

export function cjCustomerMessage(code: string) {
  switch (String(code || "").trim()) {
    case "CJ_PROPERTY_MISSING":
    case "CJ_SOCIAL_ACCOUNT_NOT_CONNECTED":
    case "CJ_SOCIAL_HANDLE_MISSING":
    case "CJ_PLATFORM_UNSUPPORTED":
      return "Connect Instagram before using this CJ offer.";
    case "CJ_PROPERTY_INACTIVE":
      return "Your Instagram connection needs to be refreshed before this offer can be used.";
    case "CJ_PROPERTY_AMBIGUOUS":
      return "This CJ offer can't be matched to one Instagram account.";
    case "CJ_PROGRAM_NOT_REVIEWED":
    case "CJ_PROGRAM_DISABLED":
    case "CJ_PROGRAM_REVIEW_ADVERTISER_MISMATCH":
    case "CJ_METHOD_NOT_ALLOWED":
    case "CJ_CONTRACT_NOT_ACTIVE":
    case "CJ_CONTRACT_ADVERTISER_MISMATCH":
      return "This offer isn't available for your connected promotion method.";
    case "CJ_PROMOTION_PLATFORM_REQUIRED":
    case "CJ_PROMOTION_PLATFORM_UNSUPPORTED":
      return "This CJ offer is currently available for Instagram promotion.";
    case "SOURCE_NOT_BETA_ENABLED":
      return "CJ offers are not available yet.";
    default:
      return "We couldn't prepare this CJ tracking link right now. Please try again.";
  }
}
