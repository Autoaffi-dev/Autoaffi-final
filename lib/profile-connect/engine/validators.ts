import { safetyScanState } from "./safety";

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
};

/**
 * Locked completion rules for Profile & Connect.
 * These rules make the setup "commission-ready" and consistent.
 */
export function validateLockedRules(stepState: any): ValidationResult {
  const reasons: string[] = [];

  // 1) One primary CTA must be selected
  const ctaType = stepState?.cta?.cta_type;
  if (!ctaType || !["dm", "link", "hybrid"].includes(ctaType)) {
    reasons.push("Primary CTA must be selected (DM, Link or Hybrid).");
  }

  // 2) Tracking link must exist
  const linkUrl = stepState?.link?.primary_link_url || stepState?.primary_link_url;
  if (!linkUrl || typeof linkUrl !== "string" || linkUrl.length < 8) {
    reasons.push("Primary link must be set (Autoaffi tracking link).");
  }

  // 3) Proof layer required
  const proofDone = !!stepState?.proof?.completed;
  if (!proofDone) {
    reasons.push("Proof Layer must be completed (at least 1 proof asset).");
  }

  // 4) Pinned conversion trio required
  const pinned = stepState?.pinned;
  const pinsDone = !!(pinned?.pin1_done && pinned?.pin2_done && pinned?.pin3_done);
  if (!pinsDone) {
    reasons.push("Pinned Conversion Trio must be completed (3 pinned assets).");
  }

  // 5) Bio must be saved
  const bio = stepState?.bio?.selected_text || stepState?.final_bio;
  if (!bio || typeof bio !== "string" || bio.trim().length < 20) {
    reasons.push("Bio must be generated and saved.");
  }

  // 6) Positioning must be done
  if (!stepState?.positioning?.done) {
    reasons.push("Positioning step must be completed (who + outcome locked).");
  }

  // 7) Safety scan
  const safety = safetyScanState(stepState);
  if (!safety.ok) {
    reasons.push(`Safety filter triggered: ${safety.hits.join(", ")}`);
  }

  return { ok: reasons.length === 0, reasons };
}