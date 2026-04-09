import { VariantTemplate } from "./types";

/**
 * Beast rule:
 * - Prefer variants the user hasn't seen recently (dedupe).
 * - Deterministic choice via seed modulo pool size.
 * - If everything seen, fall back to full pool (still deterministic).
 */
export function selectVariant(params: {
  variants: VariantTemplate[];
  seed: number;
  recentlySeenVariantIds: Set<string>;
}): VariantTemplate {
  const { variants, seed, recentlySeenVariantIds } = params;

  if (!variants || variants.length === 0) {
    throw new Error("No variants available for this step.");
  }

  const unseen = variants.filter(v => !recentlySeenVariantIds.has(v.id));
  const pool = unseen.length > 0 ? unseen : variants;

  const idx = seed % pool.length;
  return pool[idx];
}