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
