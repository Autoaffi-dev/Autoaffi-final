// =============================================================
// Autoaffi VX — Realism Filter (Frontend → Worker)
// =============================================================

export function normalizeRealism(value: number) {
  if (!value) return 5;
  if (value < 1) return 1;
  if (value > 10) return 10;
  return Math.round(value);
}