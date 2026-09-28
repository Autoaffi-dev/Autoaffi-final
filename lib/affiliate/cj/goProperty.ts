/**
 * Click-time acceptance for one stored CJ Instagram property.
 * Does not call Program Terms or Product Feed and does not build a URL.
 */

export type CjGoPropertyRow = {
  user_id?: string | null;
  platform?: string | null;
  status?: string | null;
  cj_pid?: string | null;
  property_type?: string | null;
  cj_social_platform?: string | null;
};

export function selectCjGoInstagramProperty(args: {
  userId: string;
  expectedPid: string;
  rows: CjGoPropertyRow[] | null | undefined;
}): CjGoPropertyRow | null {
  const userId = String(args.userId || "");
  const expectedPid = String(args.expectedPid || "");
  if (!userId || !expectedPid) return null;

  const rows = Array.isArray(args.rows) ? args.rows : [];
  if (rows.length !== 1) return null;

  const row = rows[0];
  if (String(row.user_id || "") !== userId) return null;
  if (String(row.platform || "").trim() !== "instagram") return null;
  if (String(row.status || "").trim() !== "ACTIVE") return null;
  if (String(row.cj_pid || "") !== expectedPid) return null;
  if (row.property_type !== "SOCIAL_MEDIA") return null;
  if (row.cj_social_platform !== "INSTAGRAM") return null;
  return row;
}
