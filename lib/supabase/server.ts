import { createClient } from "@supabase/supabase-js";

function mustGetEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

/**
 * Server-admin: använder SERVICE_ROLE_KEY.
 * OBS: Importera ALDRIG denna fil från client components.
 */
export function getSupabaseAdmin() {
  return createClient(
    mustGetEnv("SUPABASE_URL"),
    mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

/**
 * Server-anon: använder ANON_KEY (server-side).
 */
export function getSupabaseAnon() {
  return createClient(
    mustGetEnv("SUPABASE_URL"),
    mustGetEnv("SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );
}

/**
 * Auth helper (standardiserad):
 * - Preferred: Authorization: Bearer <token>
 * - Dev fallback: x-autoaffi-user-id, MEN endast giltig UUID
 *
 * Detta låser business-routes till riktig intern user identity
 * och stoppar blandning mellan target-id / custom dev-id / random header values.
 */
export async function requireUserId(req: Request): Promise<string> {
  const dev = req.headers.get("x-autoaffi-user-id")?.trim() ?? null;
  if (dev) {
    if (!isUuid(dev)) {
      throw new Error("UNAUTHORIZED");
    }
    return dev;
  }

  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = auth.slice("bearer ".length).trim();
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.id || !isUuid(data.user.id)) {
    throw new Error("UNAUTHORIZED");
  }

  return data.user.id;
}