import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ResolvedLiveState = {
  ok: boolean;
  userId: string | null;
  platform: string;
  state: Record<string, any>;
  reason?: string;
};

type Input = {
  token: string;
  userCode?: string | null;
  platform?: string;
  supabase?: SupabaseClient;
};

function getAdminSupabase(provided?: SupabaseClient) {
  if (provided) return provided;

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function resolveUserIdFromUserCode(
  supabase: SupabaseClient,
  userCode: string
) {
  const recurringRes = await supabase
    .from("user_recurring_platforms")
    .select("user_id, autoaffi_user_code, platform")
    .eq("autoaffi_user_code", userCode)
    .maybeSingle();

  if (recurringRes.error) {
    throw new Error(
      `Failed to resolve user from autoaffi user code: ${recurringRes.error.message}`
    );
  }

  return recurringRes.data?.user_id || null;
}

async function resolveUserIdFromQrAssets(
  supabase: SupabaseClient,
  token: string
) {
  const qrRes = await supabase
    .from("user_qr_assets")
    .select("user_id, token, slug")
    .or(`token.eq.${token},slug.eq.${token}`)
    .maybeSingle();

  if (!qrRes.error && qrRes.data?.user_id) {
    return qrRes.data.user_id;
  }

  return null;
}

async function resolveUserIdFromDestinations(
  supabase: SupabaseClient,
  token: string
) {
  const destinationRes = await supabase
    .from("user_offer_destinations")
    .select("user_id, destination_url, offer_key")
    .eq("offer_key", "autoaffi");

  if (destinationRes.error) {
    throw new Error(
      `Failed to resolve user from destination token: ${destinationRes.error.message}`
    );
  }

  const row = (destinationRes.data || []).find((item: any) => {
    const url = String(item?.destination_url || "");
    return (
      url.includes(`/${token}`) ||
      url.includes(`token=${token}`) ||
      url.includes(`slug=${token}`)
    );
  });

  return row?.user_id || null;
}

async function resolveUserIdFromProfileConnectState(
  supabase: SupabaseClient,
  token: string,
  platform: string
) {
  const stateRowsRes = await supabase
    .from("profile_connect_state")
    .select("user_id, platform, state_json")
    .eq("platform", platform);

  if (stateRowsRes.error) {
    throw new Error(
      `Failed to scan profile_connect_state: ${stateRowsRes.error.message}`
    );
  }

  for (const row of stateRowsRes.data || []) {
    const parsed = safeJsonParse<Record<string, any>>(row?.state_json, {});
    const slug = String(parsed?.slug || parsed?.link?.slug || "").trim();
    const offerKey = String(parsed?.offer_key || parsed?.link?.offer_key || "").trim();

    if (slug === token || offerKey === token) {
      return row.user_id as string;
    }
  }

  return null;
}

function hydrateLiveState(stateJson: Record<string, any>, token: string) {
  const slug =
    stateJson?.slug ||
    stateJson?.link?.slug ||
    token;

  const photoImage =
    stateJson?.photo?.ready_image_choice ||
    stateJson?.lead?.image_url ||
    stateJson?.offer?.image_url ||
    stateJson?.premium?.image_url ||
    null;

  return {
    ...stateJson,
    token,
    slug,
    photo: {
      ...(stateJson?.photo || {}),
      ready_image_choice:
        stateJson?.photo?.ready_image_choice ||
        photoImage ||
        null,
    },
    lead: {
      ...(stateJson?.lead || {}),
      image_url:
        stateJson?.lead?.image_url ||
        stateJson?.photo?.ready_image_choice ||
        null,
    },
    premium: {
      ...(stateJson?.premium || {}),
      image_url:
        stateJson?.premium?.image_url ||
        stateJson?.offer?.image_url ||
        stateJson?.photo?.ready_image_choice ||
        null,
    },
    offer: {
      ...(stateJson?.offer || {}),
      image_url:
        stateJson?.offer?.image_url ||
        stateJson?.premium?.image_url ||
        stateJson?.photo?.ready_image_choice ||
        null,
    },
  };
}

export async function resolveLiveProfileConnectState(
  input: Input
): Promise<ResolvedLiveState> {
  const { token, userCode, platform = "instagram" } = input;
  const supabase = getAdminSupabase(input.supabase);

  let userId: string | null = null;

  if (userCode) {
    userId = await resolveUserIdFromUserCode(supabase, userCode);
  }

  if (!userId && token) {
    userId = await resolveUserIdFromQrAssets(supabase, token);
  }

  if (!userId && token) {
    userId = await resolveUserIdFromProfileConnectState(
      supabase,
      token,
      platform
    );
  }

  if (!userId && token) {
    userId = await resolveUserIdFromDestinations(supabase, token);
  }

  if (!userId) {
    return {
      ok: false,
      userId: null,
      platform,
      state: {},
      reason: "Could not resolve user from token, profile state, destination or user code.",
    };
  }

  const stateRes = await supabase
    .from("profile_connect_state")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (stateRes.error) {
    throw new Error(
      `Failed to load profile_connect_state: ${stateRes.error.message}`
    );
  }

  const stateJson = safeJsonParse<Record<string, any>>(
    stateRes.data?.state_json,
    {}
  );

  return {
    ok: true,
    userId,
    platform,
    state: hydrateLiveState(stateJson, token),
  };
}