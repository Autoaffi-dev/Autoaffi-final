import { ContactStrategy, LeadStatus, NormalizedBusinessTarget } from "./types";

export function recommendContactStrategy(
  target: NormalizedBusinessTarget,
  status: LeadStatus
): ContactStrategy {
  const hasWebsite = !!target.website || !!target.domain;
  const hasPhone = !!target.phone;

  // V1/V1.5 principle:
  // stay conservative and brand-safe.
  // Default is safe_contact unless we have strong size signal.

  if (target.sizeHint === "LARGE") {
    // For larger orgs, allow light multithread only when quality is not weak.
    if (status === "HOT" || status === "WARM") {
      return "light_multithread";
    }
    return "safe_contact";
  }

  // Future:
  // when we have real role/contact enrichment (decision-maker email/name),
  // we can unlock "decision_maker" here.
  if (hasWebsite || hasPhone) {
    return "safe_contact";
  }

  return "safe_contact";
}