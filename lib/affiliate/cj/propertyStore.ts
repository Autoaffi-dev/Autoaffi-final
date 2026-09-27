import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  CjPropertyMappingError,
  resolveCjPidInsertConflict,
  type CjPropertyMappingInsert,
  type CjPropertyMappingRow,
  type CjPropertyMappingStore,
} from "./propertyMapping";

const TABLE = "cj_promotional_properties";

const COLUMNS = [
  "id",
  "user_id",
  "platform",
  "social_account_id",
  "social_account_identifier",
  "social_media_handle",
  "cj_social_platform",
  "cj_pid",
  "property_type",
  "status",
  "created_at",
  "updated_at",
].join(",");

export function createSupabaseCjPropertyStore(): CjPropertyMappingStore {
  return {
    findByUserProperty(userId, platform, socialAccountIdentifier) {
      return findOne({
        user_id: userId,
        platform,
        social_account_identifier: socialAccountIdentifier,
      });
    },
    findByPid(cjPid) {
      return findOne({ cj_pid: cjPid });
    },
    async insert(row) {
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from(TABLE)
        .insert({ ...row, created_at: now, updated_at: now })
        .select(COLUMNS)
        .maybeSingle();

      if (error?.code === "23505") {
        const byPid = await findOne({ cj_pid: row.cj_pid });
        const byProperty = await findOne({
          user_id: row.user_id,
          platform: row.platform,
          social_account_identifier: row.social_account_identifier,
        });
        return resolveCjPidInsertConflict(row, byPid, byProperty);
      }

      if (error || !data) {
        throw new CjPropertyMappingError("CJ_PROPERTY_STORE_FAILED");
      }

      return data as unknown as CjPropertyMappingRow;
    },
  };
}

async function findOne(
  filters: Partial<CjPropertyMappingInsert> & { cj_pid?: string }
) {
  let query = supabaseAdmin.from(TABLE).select(COLUMNS);
  for (const [key, value] of Object.entries(filters)) {
    if (value) query = query.eq(key, value);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new CjPropertyMappingError("CJ_PROPERTY_STORE_FAILED");
  }
  return (data as unknown as CjPropertyMappingRow | null) ?? null;
}
