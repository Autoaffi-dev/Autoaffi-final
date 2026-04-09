import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/authOptions";
import { getCustomerAutoaffiLink } from "@/lib/profile-connect/engine/getCustomerAutoaffiLink";
import { resolveProfileConnectLink } from "@/lib/profile-connect/engine/resolveProfileConnectLink";

export const runtime = "nodejs";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
type SetupStatus = "not_started" | "in_progress" | "completed";
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

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    const body = await req.json();
    const platform = (body?.platform || "instagram") as PlatformKey;

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
    const state = safeJsonParse<Record<string, any>>(existingRaw?.state_json, {});

    const customerLink = await getCustomerAutoaffiLink({
      userId,
      profilePlatform: platform,
      recurringPlatformKey: "autoaffi",
      supabase,
    });

    const selectedMode = (state?.link?.primary_link_type || "lead") as LinkType;
    const useAutoaffiRouting =
      (state?.link?.link_mode || "autoaffi") !== "custom";

    const offerKey = deriveOfferKey(state);
    const slug = deriveSlug(state, offerKey);
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
    } else if (!useAutoaffiRouting && state?.link?.custom_url) {
      resolvedLink = resolveProfileConnectLink({
        baseAutoaffiLink: customerLink.baseAutoaffiLink || "https://www.autoaffi.com",
        mode: selectedMode,
        customDestinationUrl: state.link.custom_url,
        useAutoaffiRouting: false,
        offerKey,
        slug,
        userCode,
      });
    }

    const hydratedState: Record<string, any> = {
      ...state,
      offer_key: offerKey,
      slug,
      autoaffi_link: customerLink.baseAutoaffiLink,
      autoaffi_link_source: customerLink.source,
      autoaffi_user_code: customerLink.autoaffiUserCode,
      link: {
        ...(state?.link || {}),
        offer_key: offerKey,
        slug,
        primary_link_url:
          resolvedLink?.finalUrl ||
          state?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
        destination_label:
          resolvedLink?.destinationLabel ||
          state?.link?.destination_label ||
          null,
        destination_path:
          resolvedLink?.destinationPath ||
          state?.link?.destination_path ||
          null,
        destination_description:
          resolvedLink?.destinationDescription ||
          state?.link?.destination_description ||
          null,
        cta_line:
          resolvedLink?.bioCta ||
          state?.link?.cta_line ||
          null,
      },
      reply_context: {
        ...(state?.reply_context || {}),
        main_link:
          resolvedLink?.finalUrl ||
          state?.reply_context?.main_link ||
          state?.link?.primary_link_url ||
          customerLink.baseAutoaffiLink ||
          null,
      },
    };

    const reasons: string[] = [];

    if (!hydratedState?.positioning?.display_name) {
      reasons.push("Missing profile name.");
    }

    if (!hydratedState?.positioning?.one_liner) {
      reasons.push("Missing profile line.");
    }

    if (!hydratedState?.photo?.image_style) {
      reasons.push("Missing profile image choice.");
    }

    if (!hydratedState?.bio?.selected_text) {
      reasons.push("Missing final bio.");
    }

    if (!hydratedState?.link?.primary_link_url) {
      reasons.push("Missing final routed destination link.");
    }

    if (!hydratedState?.link?.destination_path) {
      reasons.push("Missing lead or bridge destination path.");
    }

    if (!hydratedState?.proof?.highlight_titles) {
      reasons.push("Missing trust/highlight titles.");
    }

    if (
      !hydratedState?.pinned?.pin1_text ||
      !hydratedState?.pinned?.pin2_text ||
      !hydratedState?.pinned?.pin3_text
    ) {
      reasons.push("Missing pinned assets.");
    }

    if (
      !hydratedState?.pinned?.pin1_prompt ||
      !hydratedState?.pinned?.pin2_prompt ||
      !hydratedState?.pinned?.pin3_prompt
    ) {
      reasons.push("Missing pinned image prompts.");
    }

    if (
      !hydratedState?.cta?.quick_reply_1 ||
      !hydratedState?.cta?.quick_reply_2 ||
      !hydratedState?.cta?.quick_reply_3
    ) {
      reasons.push("Missing reply system.");
    }

    const score = calculateScore(hydratedState);
    const canComplete = reasons.length === 0 && score >= 100;
    const status = canComplete ? "completed" : deriveStatus(score);

    const upsertRes = await supabase.from("profile_connect_state").upsert(
      {
        user_id: userId,
        platform,
        state_json: JSON.stringify(hydratedState),
        score,
        status,
        completed_at: canComplete ? new Date().toISOString() : null,
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
      ok: canComplete,
      platform,
      score,
      status,
      reasons,
      why: canComplete
        ? [
            "Profile name is ready.",
            "Bio is ready.",
            "Correct routed customer link is attached.",
            "Lead or personal bridge destination is attached.",
            "Trust setup is ready.",
            "Pinned assets and image prompts are ready.",
            "Reply system is ready.",
          ]
        : reasons,
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
        error: error?.message || "Failed to complete profile connect setup",
      },
      { status: 500 }
    );
  }
}