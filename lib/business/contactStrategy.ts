import { ContactStrategy, LeadStatus, NormalizedBusinessTarget } from "./types";

export function recommendContactStrategy(
  target: NormalizedBusinessTarget,
  status: LeadStatus
): ContactStrategy {
  const hasWebsite = !!target.website || !!target.domain;
  const hasPhone = !!target.phone;

  // V1: No people/roles yet; so we keep it conservative.
  // Later: if we detect decision-maker email/role -> "decision_maker"
  // Later: for large companies -> "light_multithread"

  if (target.sizeHint === "LARGE") {
    // Large orgs: sequential, light multithread only if HOT/WARM
    return status === "HOT" || status === "WARM"
      ? "light_multithread"
      : "safe_contact";
  }

  // Small/mid orgs: start safe unless we have rich signals later.
  if (hasWebsite || hasPhone) {
    // Default safe contact first (info@/form/phone) in V1
    return "safe_contact";
  }

  return "safe_contact";
}