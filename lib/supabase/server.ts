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
 * Canonical user identity for normal logged-in Autoaffi routes.
 * Re-exported so existing `@/lib/supabase/server` imports keep working
 * without a second authorization implementation.
 *
 * Behavior lives in lib/auth/server.ts (NextAuth session.user.id).
 * This is NOT a Bearer / header dual-auth fallback.
 */
export { requireUserId } from "@/lib/auth/server";