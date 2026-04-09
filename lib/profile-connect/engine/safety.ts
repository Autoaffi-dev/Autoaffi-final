/**
 * Locked "anti-scam" guardrails for Profile & Connect.
 * This prevents profiles that trigger distrust or platform policy issues.
 */

const BANNED_PHRASES = [
  "get rich quick",
  "guaranteed income",
  "guaranteed results",
  "easy money",
  "make $",
  "make €",
  "make £",
  "earn $",
  "earn €",
  "earn £",
  "make money fast",
  "risk free",
  "instant income",
];

export function safetyScanText(text: string): { ok: boolean; hits: string[] } {
  const lower = (text || "").toLowerCase();
  const hits = BANNED_PHRASES.filter(p => lower.includes(p));
  return { ok: hits.length === 0, hits };
}

/**
 * Scan common fields inside step_state.
 * Keep this conservative: only scan a few fields to avoid noise.
 */
export function safetyScanState(stepState: any): { ok: boolean; hits: string[] } {
  const fields: string[] = [];

  // Bio / positioning
  if (stepState?.bio?.selected_text) fields.push(stepState.bio.selected_text);
  if (stepState?.final_bio) fields.push(stepState.final_bio);
  if (stepState?.positioning?.one_liner) fields.push(stepState.positioning.one_liner);

  // Pinned / CTA notes
  if (stepState?.pinned?.notes) fields.push(stepState.pinned.notes);
  if (stepState?.cta?.notes) fields.push(stepState.cta.notes);

  const hitsAll: string[] = [];
  for (const f of fields) {
    const r = safetyScanText(f);
    if (!r.ok) hitsAll.push(...r.hits);
  }

  return { ok: hitsAll.length === 0, hits: Array.from(new Set(hitsAll)) };
}

export const TRUST_LINE_OPTIONS = [
  "Results vary — this is a structure, not a promise.",
  "No hype. Just a simple plan you can follow.",
  "Education + execution — not guarantees.",
];
