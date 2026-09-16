type InboxConnectionRow = {
  id?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export function isWorkingGmailConnection(
  row: InboxConnectionRow | null | undefined
): boolean {
  if (!row?.id) return false;
  const status = String(row.status ?? "").trim().toLowerCase();
  return status === "connected" && row.is_active === true;
}

export function mergeInboxOauthAttemptMetadata(
  existing: Record<string, unknown> | null | undefined,
  attempt: {
    oauth_state: string;
    oauth_started_at: string;
    oauth_redirect_uri: string;
  }
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};

  return {
    ...base,
    oauth_state: attempt.oauth_state,
    oauth_started_at: attempt.oauth_started_at,
    oauth_redirect_uri: attempt.oauth_redirect_uri,
  };
}

export function disconnectedInboxIds(
  rows: Array<{ id?: string | null }> | null | undefined
): string[] {
  return (rows ?? [])
    .map((row) => String(row?.id ?? "").trim())
    .filter(Boolean);
}
