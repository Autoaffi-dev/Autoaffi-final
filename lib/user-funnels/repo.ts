export type UserFunnelRow = {
  id: string;
  user_id: string;
  name: string;
  funnel_url: string;
  created_at: string;
};

type FunnelQueryResult<T> = {
  data: T;
  error: { message?: string } | null;
};

export type UserFunnelsDb = {
  from: (table: "user_funnels") => any;
};

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * External funnel URL is stored as the user provided it (trim only).
 * No provider rewrite — HBA, OLSP, and other published funnels stay as-is.
 */
export function normalizeExternalFunnelFields(input: {
  name?: unknown;
  funnel_url?: unknown;
  userId?: unknown;
  user_id?: unknown;
  id?: unknown;
}): { name: string; funnel_url: string } {
  void input.userId;
  void input.user_id;
  void input.id;
  return {
    name: asTrimmedString(input.name),
    funnel_url: asTrimmedString(input.funnel_url),
  };
}

export async function listOwnFunnels(
  supabase: UserFunnelsDb,
  userId: string
): Promise<FunnelQueryResult<UserFunnelRow[]>> {
  const { data, error } = await supabase
    .from("user_funnels")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return { data: (data || []) as UserFunnelRow[], error: null };
}

export async function insertOwnFunnel(
  supabase: UserFunnelsDb,
  userId: string,
  input: { name: string; funnel_url: string }
): Promise<FunnelQueryResult<null>> {
  const { error } = await supabase.from("user_funnels").insert({
    user_id: userId,
    name: input.name,
    funnel_url: input.funnel_url,
  });
  return { data: null, error: error ?? null };
}

export async function deleteOwnFunnel(
  supabase: UserFunnelsDb,
  userId: string,
  funnelId: string
): Promise<FunnelQueryResult<UserFunnelRow[]>> {
  const { data, error } = await supabase
    .from("user_funnels")
    .delete()
    .eq("id", funnelId)
    .eq("user_id", userId)
    .select("id");

  if (error) return { data: [], error };
  return { data: (data || []) as UserFunnelRow[], error: null };
}
