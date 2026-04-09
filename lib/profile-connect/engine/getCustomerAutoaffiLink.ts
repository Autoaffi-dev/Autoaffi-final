import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CustomerAutoaffiLinkResult = {
  ok: boolean;
  userId: string;
  autoaffiUserCode: string | null;
  platform: string;
  baseAutoaffiLink: string | null;
  source:
    | "user_recurring_platforms"
    | "user_offer_destinations"
    | "env_fallback"
    | "not_found";
};

type Input = {
  userId: string;
  /**
   * Profile platform: instagram / tiktok / youtube / linkedin / x
   * We keep this field mostly for future routing / diagnostics.
   */
  profilePlatform: string;
  /**
   * Recurring platform key that should be used as the primary Autoaffi source.
   * Default is "autoaffi".
   */
  recurringPlatformKey?: string;
  supabase?: SupabaseClient;
};

function getAdminSupabase(provided?: SupabaseClient): SupabaseClient {
  if (provided) return provided;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildAutoaffiGoLink(autoaffiUserCode: string): string {
  const publicBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://www.autoaffi.com";

  const cleanBase = publicBase.replace(/\/+$/, "");
  return `${cleanBase}/go/autoaffi?u=${encodeURIComponent(autoaffiUserCode)}`;
}

/**
 * Priority:
 * 1) user_recurring_platforms.autoaffi_user_code for platform="autoaffi"
 * 2) user_offer_destinations destination_url for offer_key="autoaffi"
 * 3) env fallback if explicitly configured
 */
export async function getCustomerAutoaffiLink(
  input: Input
): Promise<CustomerAutoaffiLinkResult> {
  const { userId, profilePlatform, recurringPlatformKey = "autoaffi" } = input;
  const supabase = getAdminSupabase(input.supabase);

  if (!userId) {
    throw new Error("Missing userId.");
  }

  // 1) Preferred source = recurring tracking id
  const recurringRes = await supabase
    .from("user_recurring_platforms")
    .select("platform, autoaffi_user_code")
    .eq("user_id", userId)
    .eq("platform", recurringPlatformKey)
    .maybeSingle();

  if (recurringRes.error) {
    throw new Error(`Failed to read user_recurring_platforms: ${recurringRes.error.message}`);
  }

  const recurringCode = recurringRes.data?.autoaffi_user_code || null;

  if (recurringCode) {
    return {
      ok: true,
      userId,
      autoaffiUserCode: recurringCode,
      platform: profilePlatform,
      baseAutoaffiLink: buildAutoaffiGoLink(recurringCode),
      source: "user_recurring_platforms",
    };
  }

  // 2) Fallback = explicit offer destination if customer has one saved
  const destinationRes = await supabase
    .from("user_offer_destinations")
    .select("destination_url, offer_key")
    .eq("user_id", userId)
    .eq("offer_key", "autoaffi")
    .maybeSingle();

  if (destinationRes.error) {
    throw new Error(`Failed to read user_offer_destinations: ${destinationRes.error.message}`);
  }

  const destinationUrl = (destinationRes.data?.destination_url || "").trim();

  if (destinationUrl) {
    return {
      ok: true,
      userId,
      autoaffiUserCode: null,
      platform: profilePlatform,
      baseAutoaffiLink: destinationUrl,
      source: "user_offer_destinations",
    };
  }

  // 3) Optional env fallback for dev/testing only
  const envFallback = (process.env.PROFILE_CONNECT_AUTOAFFI_LINK_FALLBACK || "").trim();
  if (envFallback) {
    return {
      ok: true,
      userId,
      autoaffiUserCode: null,
      platform: profilePlatform,
      baseAutoaffiLink: envFallback,
      source: "env_fallback",
    };
  }

  return {
    ok: false,
    userId,
    autoaffiUserCode: null,
    platform: profilePlatform,
    baseAutoaffiLink: null,
    source: "not_found",
  };
}