import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/authOptions";
import { getCustomerAutoaffiLink } from "@/lib/profile-connect/engine/getCustomerAutoaffiLink";
import { resolveProfileConnectLink } from "@/lib/profile-connect/engine/resolveProfileConnectLink";
import { buildConnectionProfile } from "@/lib/profile-connect/engine/buildConnectionProfile";

export const runtime = "nodejs";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
type SetupStatus = "not_started" | "in_progress" | "completed";
type LinkType = "lead" | "bridge";
type CTAType = "dm" | "link" | "hybrid";

type PublicAssetRow = {
  id?: string | number | null;
  token?: string | null;
  slug?: string | null;
};

function getAdminSupabase() {
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

async function getUserId(req: Request) {
  const devHeader = req.headers.get("x-autoaffi-user-id");
  if (devHeader) return devHeader;

  const devEnv = process.env.NEXT_PUBLIC_DEV_USER_ID;
  if (devEnv) return devEnv;

  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id;

  if (!userId) throw new Error("Unauthorized");
  return userId as string;
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mergeDeep(target: any, patch: any): any {
  if (typeof target !== "object" || target === null) return patch;
  if (typeof patch !== "object" || patch === null) return patch;

  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(patch)) {
    const targetValue = target[key];
    const patchValue = patch[key];

    if (
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue) &&
      typeof patchValue === "object" &&
      patchValue !== null &&
      !Array.isArray(patchValue)
    ) {
      result[key] = mergeDeep(targetValue, patchValue);
    } else {
      result[key] = patchValue;
    }
  }

  return result;
}

function calculateScore(state: Record<string, any>) {
  const keys = [
    "positioning",
    "photo",
    "bio",
    "link",
    "proof",
    "pinned",
    "cta",
  ] as const;

  const completed = keys.reduce((acc, key) => {
    const step = state?.[key];
    if (step?.done || step?.completed) return acc + 1;
    return acc;
  }, 0);

  return Math.min(100, Math.round((completed / keys.length) * 100));
}

function deriveStatus(score: number): SetupStatus {
  if (score >= 100) return "completed";
  if (score > 0) return "in_progress";
  return "not_started";
}

function deriveOfferKey(state: Record<string, any>) {
  return (
    state?.offer_key ||
    state?.selected_offer_key ||
    state?.link?.offer_key ||
    state?.recurring?.offer_key ||
    "autoaffi"
  );
}

function deriveSlug(state: Record<string, any>, offerKey: string) {
  return state?.slug || state?.link?.slug || state?.recurring?.slug || offerKey;
}

function withGeneratedConnectionProfile(state: Record<string, any>) {
  const generated = buildConnectionProfile(state);

  return {
    ...state,
    connection: {
      ...(state?.connection || {}),
      headline: state?.connection?.headline || generated.connectionHeadline,
      subheadline: state?.connection?.subheadline || generated.connectionSubheadline,
      who_i_am_title: state?.connection?.who_i_am_title || generated.whoIAmTitle,
      who_i_am_text: state?.connection?.who_i_am_text || generated.whoIAmText,
      what_i_believe_title:
        state?.connection?.what_i_believe_title || generated.whatIBelieveTitle,
      what_i_believe_text:
        state?.connection?.what_i_believe_text ||
        state?.connection?.belief_statement ||
        generated.whatIBelieveText,
      why_i_share_title:
        state?.connection?.why_i_share_title || generated.whyIShareTitle,
      why_i_share_text:
        state?.connection?.why_i_share_text || generated.whyIShareText,
      if_you_are_like_me_title:
        state?.connection?.if_you_are_like_me_title || generated.ifYouAreLikeMeTitle,
      if_you_are_like_me_points:
        state?.connection?.if_you_are_like_me_points?.length
          ? state.connection.if_you_are_like_me_points
          : generated.ifYouAreLikeMePoints,
    },
  };
}

function clearComputedLinkFields(linkState: Record<string, any> = {}) {
  return {
    ...linkState,
    primary_link_url: null,
    destination_label: null,
    destination_path: null,
    destination_description: null,
    cta_line: null,
  };
}

function randToken(len = 18) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function ensureProfileConnectPublicAsset(input: {
  supabase: any;
  userId: string;
  offerKey: string;
  slug: string;
  destinationMode: "lead" | "both";
  destinationUrl: string | null;
}): Promise<PublicAssetRow> {
  const {
    supabase,
    userId,
    offerKey,
    slug,
    destinationMode,
    destinationUrl,
  } = input;

  const safeSlug = String(slug || offerKey || "autoaffi").trim() || "autoaffi";

  const existingRes = await (supabase.from("user_qr_assets") as any)
    .select("id, token, slug, destination_mode, destination_url, offer_key")
    .eq("user_id", userId)
    .eq("offer_key", offerKey)
    .eq("slug", safeSlug)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(`Failed to read user_qr_assets: ${existingRes.error.message}`);
  }

  const existing = (existingRes.data || null) as PublicAssetRow | null;

  if (existing?.id) {
    const updateRes = await (supabase.from("user_qr_assets") as any)
      .update({
        destination_mode: destinationMode,
        destination_url: destinationUrl,
        slug: safeSlug,
      })
      .eq("id", existing.id)
      .select("id, token, slug")
      .single();

    if (updateRes.error) {
      throw new Error(`Failed to update profile asset: ${updateRes.error.message}`);
    }

    return (updateRes.data || {}) as PublicAssetRow;
  }

  const token = randToken(18);

  const insertRes = await (supabase.from("user_qr_assets") as any)
    .insert({
      user_id: userId,
      offer_key: offerKey,
      product_type: "sticker",
      destination_mode: destinationMode,
      destination_url: destinationUrl,
      token,
      slug: safeSlug,
      storage_path: null,
      qr_png_path: null,
    })
    .select("id, token, slug")
    .single();

  if (insertRes.error) {
    throw new Error(`Failed to insert profile asset: ${insertRes.error.message}`);
  }

  return (insertRes.data || {}) as PublicAssetRow;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    const body = await req.json();

    const platform = (body?.platform || "instagram") as PlatformKey;
    const stepStatePatch = (body?.step_state_patch || {}) as Record<string, any>;

    const supabase = getAdminSupabase();

    const existingRes = await supabase
      .from("profile_connect_state")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (existingRes.error) {
      throw new Error(existingRes.error.message);
    }

    const existingRaw = existingRes.data || null;
    const existingState = safeJsonParse<Record<string, any>>(
      existingRaw?.state_json,
      {}
    );

    const previousMode = (existingState?.link?.primary_link_type || "lead") as LinkType;
    const previousLinkMode = existingState?.link?.link_mode || "autoaffi";

    let nextState = mergeDeep(existingState, stepStatePatch);

    const patchedMode = (
      stepStatePatch?.link?.primary_link_type ||
      nextState?.link?.primary_link_type ||
      "lead"
    ) as LinkType;

    const patchedLinkMode =
      stepStatePatch?.link?.link_mode ||
      nextState?.link?.link_mode ||
      "autoaffi";

    const modeChanged = patchedMode !== previousMode;
    const linkModeChanged = patchedLinkMode !== previousLinkMode;
    const customUrlChanged =
      typeof stepStatePatch?.link?.custom_url !== "undefined";

    if (modeChanged || linkModeChanged || customUrlChanged) {
      nextState = {
        ...nextState,
        link: clearComputedLinkFields(nextState?.link || {}),
        reply_context: {
          ...(nextState?.reply_context || {}),
          main_link: null,
        },
      };
    }

    const customerLink = await getCustomerAutoaffiLink({
      userId,
      profilePlatform: platform,
      recurringPlatformKey: "autoaffi",
      supabase,
    });

    const selectedMode = (nextState?.link?.primary_link_type || "lead") as LinkType;
    const selectedCtaType = (nextState?.bio?.cta_type || "dm") as CTAType;
    const useAutoaffiRouting =
      (nextState?.link?.link_mode || "autoaffi") !== "custom";

    const offerKey = deriveOfferKey(nextState);
    const slug = deriveSlug(nextState, offerKey);
    const userCode = customerLink.autoaffiUserCode || undefined;

    let resolvedLink: ReturnType<typeof resolveProfileConnectLink> | null = null;

    if (useAutoaffiRouting && customerLink.baseAutoaffiLink) {
      resolvedLink = resolveProfileConnectLink({
        baseAutoaffiLink: customerLink.baseAutoaffiLink,
        mode: selectedMode,
        useAutoaffiRouting: true,
        offerKey,
        slug,
        userCode,
      });
    } else if (!useAutoaffiRouting && nextState?.link?.custom_url) {
      resolvedLink = resolveProfileConnectLink({
        baseAutoaffiLink:
          customerLink.baseAutoaffiLink || "https://www.autoaffi.com",
        mode: selectedMode,
        customDestinationUrl: nextState.link.custom_url,
        useAutoaffiRouting: false,
        offerKey,
        slug,
        userCode,
      });
    }

    nextState = {
      ...nextState,
      offer_key: offerKey,
      slug,
      autoaffi_link: customerLink.baseAutoaffiLink,
      autoaffi_link_source: customerLink.source,
      autoaffi_user_code: customerLink.autoaffiUserCode,
      profile_platform: platform,
      link: {
        ...(nextState?.link || {}),
        offer_key: offerKey,
        slug,
        primary_link_type: selectedMode,
        link_mode: nextState?.link?.link_mode || "autoaffi",
        primary_link_url:
          resolvedLink?.finalUrl ||
          nextState?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
        destination_label:
          resolvedLink?.destinationLabel ||
          nextState?.link?.destination_label ||
          null,
        destination_path:
          resolvedLink?.destinationPath ||
          nextState?.link?.destination_path ||
          null,
        destination_description:
          resolvedLink?.destinationDescription ||
          nextState?.link?.destination_description ||
          null,
        cta_line:
          resolvedLink?.bioCta ||
          nextState?.link?.cta_line ||
          null,
        last_resolved_mode: selectedMode,
      },
      bio: {
        ...(nextState?.bio || {}),
        cta_type: selectedCtaType,
      },
      reply_context: {
        ...(nextState?.reply_context || {}),
        main_link:
          resolvedLink?.finalUrl ||
          nextState?.reply_context?.main_link ||
          nextState?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
      },
    };

    nextState = withGeneratedConnectionProfile(nextState);

    const publicDestinationMode: "lead" | "both" =
      selectedMode === "bridge" ? "both" : "lead";

    const publicDestinationUrl =
      resolvedLink?.finalUrl ||
      nextState?.link?.primary_link_url ||
      customerLink.baseAutoaffiLink ||
      null;

    const publicAsset = await ensureProfileConnectPublicAsset({
      supabase,
      userId,
      offerKey,
      slug,
      destinationMode: publicDestinationMode,
      destinationUrl: publicDestinationUrl,
    });

    nextState = {
      ...nextState,
      public_asset: {
        ...(nextState?.public_asset || {}),
        token: publicAsset?.token || null,
        slug: publicAsset?.slug || slug,
      },
    };

    const score = calculateScore(nextState);
    const status = deriveStatus(score);

    const upsertRes = await supabase.from("profile_connect_state").upsert(
      {
        user_id: userId,
        platform,
        state_json: JSON.stringify(nextState),
        score,
        status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,platform",
      }
    );

    if (upsertRes.error) {
      throw new Error(upsertRes.error.message);
    }

    return NextResponse.json({
      ok: true,
      platform,
      score,
      status,
      state: nextState,
      autoaffi: {
        source: customerLink.source,
        autoaffi_user_code: customerLink.autoaffiUserCode,
        base_link: customerLink.baseAutoaffiLink,
        resolved_link: resolvedLink?.finalUrl || null,
        destination_path: resolvedLink?.destinationPath || null,
        offer_key: offerKey,
        slug,
        public_asset: nextState?.public_asset || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save profile connect state",
      },
      { status: 500 }
    );
  }
}