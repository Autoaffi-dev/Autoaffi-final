/**
 * Beast scoring (0–100).
 * Completion requires score >= 90.
 * Returns "why bullets" for UI.
 */
export function scoreState(stepState: any): { score: number; why: string[] } {
  let score = 0;
  const why: string[] = [];

  // Positioning (15)
  const posOk = !!stepState?.positioning?.done;
  if (posOk) {
    score += 15;
    why.push("Positioning locked (who + outcome).");
  }

  // Photo (10)
  const photoOk = !!stepState?.photo?.done;
  if (photoOk) {
    score += 10;
    why.push("Profile photo/branding aligned.");
  }

  // Bio (20)
  const bioOk = !!(stepState?.bio?.selected_text || stepState?.final_bio);
  if (bioOk) {
    score += 20;
    why.push("Bio + CTA clarity completed.");
  }

  // Link & Tracking (20)
  const linkOk = !!stepState?.link?.primary_link_url;
  const trackingOk = !!stepState?.link?.tracking_active;
  if (linkOk) score += 10;
  if (trackingOk) score += 10;
  if (linkOk && trackingOk) why.push("Tracking link installed and active.");

  // Proof (15)
  const proofOk = !!stepState?.proof?.completed;
  if (proofOk) {
    score += 15;
    why.push("Proof layer installed.");
  }

  // Pinned Trio (15)
  const pinsOk = !!(stepState?.pinned?.pin1_done && stepState?.pinned?.pin2_done && stepState?.pinned?.pin3_done);
  if (pinsOk) {
    score += 15;
    why.push("Pinned conversion trio complete.");
  }

  // CTA scripts (5)
  const scriptsOk = !!stepState?.cta?.scripts_saved;
  if (scriptsOk) {
    score += 5;
    why.push("CTA automation scripts saved.");
  }

  return { score, why };
}
