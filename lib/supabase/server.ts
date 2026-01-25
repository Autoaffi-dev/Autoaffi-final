import { createClient } from "@supabase/supabase-js";

function mustGetEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
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
 * V1 auth helper:
 * - Preferred: Authorization: Bearer <token>
 * - Dev fallback: x-autoaffi-user-id header
 */
export async function requireUserId(req: Request): Promise<string> {
  const dev = req.headers.get("x-autoaffi-user-id");
  if (dev) return dev;

  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) throw new Error("UNAUTHORIZED");

  const token = auth.slice("bearer ".length).trim();
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.id) throw new Error("UNAUTHORIZED");
  return data.user.id;
}