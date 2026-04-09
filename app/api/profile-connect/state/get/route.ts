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
type CTAType = "dm" | "link" | "hybrid";
type LinkType = "lead" | "bridge";

function getAdminSupabase() {
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

function clampScore(value: number) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
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

function withGeneratedConnectionProfile(state: Record<string, any>): Record<string, any> {
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

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    const { searchParams } = new URL(req.url);

    const platform = (searchParams.get("platform") || "instagram") as PlatformKey;

    const supabase = getAdminSupabase();

    const stateRes = await supabase
      .from("profile_connect_state")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (stateRes.error) {
      throw new Error(stateRes.error.message);
    }

    const rawState = stateRes.data || null;
    const savedState = safeJsonParse<Record<string, any>>(rawState?.state_json, {});

    const score = clampScore(Number(rawState?.score || 0));
    const status = deriveStatus(score);

    const customerLink = await getCustomerAutoaffiLink({
      userId,
      profilePlatform: platform,
      recurringPlatformKey: "autoaffi",
      supabase,
    });

    const selectedMode = (savedState?.link?.primary_link_type || "lead") as LinkType;
    const selectedCtaType = (savedState?.bio?.cta_type || "dm") as CTAType;
    const useAutoaffiRouting =
      (savedState?.link?.link_mode || "autoaffi") !== "custom";

    const offerKey = deriveOfferKey(savedState);
    const slug = deriveSlug(savedState, offerKey);
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
    } else if (!useAutoaffiRouting && savedState?.link?.custom_url) {
      resolvedLink = resolveProfileConnectLink({
        baseAutoaffiLink: customerLink.baseAutoaffiLink || "https://www.autoaffi.com",
        mode: selectedMode,
        customDestinationUrl: savedState.link.custom_url,
        useAutoaffiRouting: false,
        offerKey,
        slug,
        userCode,
      });
    }

    let hydratedState: Record<string, any> = {
      ...savedState,
      offer_key: offerKey,
      slug,
      autoaffi_link: customerLink.baseAutoaffiLink,
      autoaffi_link_source: customerLink.source,
      autoaffi_user_code: customerLink.autoaffiUserCode,
      profile_platform: platform,
      link: {
        ...(savedState?.link || {}),
        offer_key: offerKey,
        slug,
        primary_link_type: selectedMode,
        link_mode: savedState?.link?.link_mode || "autoaffi",
        primary_link_url:
          resolvedLink?.finalUrl ||
          savedState?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
        destination_label:
          resolvedLink?.destinationLabel ||
          savedState?.link?.destination_label ||
          null,
        destination_path:
          resolvedLink?.destinationPath ||
          savedState?.link?.destination_path ||
          null,
        destination_description:
          resolvedLink?.destinationDescription ||
          savedState?.link?.destination_description ||
          null,
        cta_line:
          resolvedLink?.bioCta ||
          savedState?.link?.cta_line ||
          null,
      },
      bio: {
        ...(savedState?.bio || {}),
        cta_type: selectedCtaType,
      },
      reply_context: {
        ...(savedState?.reply_context || {}),
        main_link:
          resolvedLink?.finalUrl ||
          savedState?.reply_context?.main_link ||
          savedState?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
      },
    };

    hydratedState = withGeneratedConnectionProfile(hydratedState);

    return NextResponse.json({
      ok: true,
      platform,
      score,
      status,
      updated_at: rawState?.updated_at || null,
      state: hydratedState,
      autoaffi: {
        source: customerLink.source,
        autoaffi_user_code: customerLink.autoaffiUserCode,
        base_link: customerLink.baseAutoaffiLink,
        resolved_link: resolvedLink?.finalUrl || null,
        destination_path: resolvedLink?.destinationPath || null,
        offer_key: offerKey,
        slug,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load profile connect state",
      },
      { status: 500 }
    );
  }
}