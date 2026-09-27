export type CjPropertyMappingRow = {
  id: string;
  user_id: string;
  platform: string;
  social_account_id: string | null;
  social_account_identifier: string;
  social_media_handle: string;
  cj_social_platform: string;
  cj_pid: string;
  property_type: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type CjPropertyMappingInsert = {
  user_id: string;
  platform: string;
  social_account_id: string | null;
  social_account_identifier: string;
  social_media_handle: string;
  cj_social_platform: string;
  cj_pid: string;
  property_type: string;
  status: string;
};

export type CjPropertyMappingStore = {
  findByUserProperty(
    userId: string,
    platform: string,
    socialAccountIdentifier: string
  ): Promise<CjPropertyMappingRow | null>;
  findByPid(cjPid: string): Promise<CjPropertyMappingRow | null>;
  insert(row: CjPropertyMappingInsert): Promise<CjPropertyMappingRow>;
};

export class CjPropertyMappingError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "CjPropertyMappingError";
    this.code = code;
  }
}

export type CjPropertyIdentity = {
  user_id: string;
  platform: string;
  social_account_identifier: string;
};

/**
 * A stored PID may be reused only for the same user and the same social property.
 * Another user is an ownership failure. The same user on a different property is a mismatch.
 * Inactive mappings are not a successful sync.
 */
export function assertReusablePidMapping(
  existing: CjPropertyMappingRow,
  expected: CjPropertyIdentity
): CjPropertyMappingRow {
  if (existing.user_id !== expected.user_id) {
    throw new CjPropertyMappingError("CJ_PID_OWNED_BY_ANOTHER_USER");
  }

  if (
    existing.platform !== expected.platform ||
    existing.social_account_identifier !== expected.social_account_identifier
  ) {
    throw new CjPropertyMappingError("CJ_PID_PROPERTY_MISMATCH");
  }

  if (String(existing.status || "").trim().toUpperCase() !== "ACTIVE" || !existing.cj_pid) {
    throw new CjPropertyMappingError("CJ_PROPERTY_INACTIVE");
  }

  return existing;
}

export function resolveCjPidInsertConflict(
  row: CjPropertyMappingInsert,
  byPid: CjPropertyMappingRow | null,
  byProperty: CjPropertyMappingRow | null
): CjPropertyMappingRow {
  if (byPid) {
    return assertReusablePidMapping(byPid, row);
  }

  if (byProperty) {
    if (byProperty.cj_pid !== row.cj_pid) {
      throw new CjPropertyMappingError("CJ_PID_PROPERTY_MISMATCH");
    }
    return assertReusablePidMapping(byProperty, row);
  }

  throw new CjPropertyMappingError("CJ_PROPERTY_STORE_FAILED");
}
