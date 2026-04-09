import crypto from "crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashToInt(hex: string): number {
  // first 12 hex chars -> ~48 bits (safe for modulo selection)
  const slice = hex.slice(0, 12);
  return parseInt(slice, 16);
}

/**
 * Rotation key:
 * - daily: stable per UTC date (consistent for the day)
 * - session: stable per client session id
 */
export function buildRotationKey(mode: "daily" | "session", sessionId?: string): string {
  if (mode === "daily") {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // session mode
  if (sessionId && sessionId.length >= 10) return sessionId;
  return crypto.randomUUID();
}

/**
 * Deterministic seed for variant selection.
 * Combine user+platform+step+rotationKey.
 */
export function buildSeed(params: {
  userId: string;
  platform: string;
  step: string;
  rotationKey: string;
}): number {
  const raw = `${params.userId}::${params.platform}::${params.step}::${params.rotationKey}`;
  return hashToInt(sha256(raw));
}

/**
 * Force-new trick: perturb rotation key so we never pick the same output.
 */
export function forceNewRotationKey(rotationKey: string): string {
  return `${rotationKey}::regen::${Date.now()}`;
}
