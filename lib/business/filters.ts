import { NormalizedBusinessTarget } from "./types";

export type FilterContext = {
  suppressedKeys?: Set<string>; // key = `${source}:${sourceId}`
  claimedKeys?: Set<string>;    // claimed by OTHER users
};

export function targetKey(t: NormalizedBusinessTarget): string {
  return `${t.source}:${t.sourceId}`;
}

export function filterSuppressedAndClaimed(
  targets: NormalizedBusinessTarget[],
  ctx: FilterContext
): NormalizedBusinessTarget[] {
  const suppressed = ctx.suppressedKeys ?? new Set<string>();
  const claimed = ctx.claimedKeys ?? new Set<string>();

  return targets.filter((t) => {
    const key = targetKey(t);
    if (suppressed.has(key)) return false;
    if (claimed.has(key)) return false;
    return true;
  });
}