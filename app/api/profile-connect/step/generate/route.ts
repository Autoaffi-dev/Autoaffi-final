import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/authOptions";
import { getCustomerAutoaffiLink } from "@/lib/profile-connect/engine/getCustomerAutoaffiLink";
import { resolveProfileConnectLink } from "@/lib/profile-connect/engine/resolveProfileConnectLink";
import instagram from "@/lib/profile-connect/packs/instagram";
import tiktok from "@/lib/profile-connect/packs/tiktok";
import youtube from "@/lib/profile-connect/packs/youtube";
import linkedin from "@/lib/profile-connect/packs/linkedin";
import xPack from "@/lib/profile-connect/packs/x";

export const runtime = "nodejs";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
type StepKey =
  | "positioning"
  | "photo"
  | "bio"
  | "link"
  | "proof"
  | "pinned"
  | "cta"
  | "final_kit";

type LinkType = "lead" | "bridge";
type CTAType = "dm" | "link" | "hybrid";

type PackStepPayload = {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string[];
  copy_blocks?: Array<{
    label: string;
    text: string;
    paste_target?: string;
    helper?: string;
  }>;
  completion_requirements?: string[];
};

const PACKS = {
  instagram,
  tiktok,
  youtube,
  linkedin,
  x: xPack,
} as const;

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

function pickPayload(
  platform: PlatformKey,
  step: StepKey,
  rotationMode?: string,
  sessionId?: string
): PackStepPayload {
  const pack = PACKS[platform];
  const items = pack.steps[step] || [];
  if (!items.length) {
    throw new Error(`No pack payload found for ${platform}:${step}`);
  }

  if (rotationMode === "session" && sessionId) {
    const index =
      Math.abs(
        Array.from(`${platform}:${step}:${sessionId}`).reduce(
          (acc, ch) => acc + ch.charCodeAt(0),
          0
        )
      ) % items.length;
    return items[index] as PackStepPayload;
  }

  return items[0] as PackStepPayload;
}

function injectDynamicContent(
  step: StepKey,
  payload: PackStepPayload,
  ctx: {
    routedLink: string | null;
    destinationLabel: string | null;
    destinationPath: string | null;
    destinationDescription: string | null;
    ctaType: CTAType;
  }
): PackStepPayload {
  const routedLink = ctx.routedLink || "[your routed link]";
  const destinationLabel = ctx.destinationLabel || "Selected destination";
  const destinationPath = ctx.destinationPath || "[destination path]";
  const destinationDescription =
    ctx.destinationDescription || "Selected destination path";

  const nextCopyBlocks =
    payload.copy_blocks?.map((block) => {
      let text = block.text || "";

      if (step === "bio" && (ctx.ctaType === "link" || ctx.ctaType === "hybrid")) {
        if (!text.includes(routedLink) && (text.includes("Use the link") || text.includes("Start here"))) {
          text = `${text}\n${routedLink}`;
        }
      }

      if (step === "link") {
        text =
          `${text}\n` +
          `Destination: ${destinationLabel}\n` +
          `Path: ${destinationPath}\n` +
          `Link: ${routedLink}\n` +
          `Why: ${destinationDescription}`;
      }

      if (step === "cta") {
        text = text.replace("[PASTE YOUR MAIN LINK]", routedLink);
      }

      return {
        ...block,
        text,
      };
    }) || [];

  return {
    ...payload,
    copy_blocks: nextCopyBlocks,
  };
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    const body = await req.json();

    const platform = (body?.platform || "instagram") as PlatformKey;
    const step = (body?.step || "positioning") as StepKey;
    const rotationMode = body?.rotation_mode || "session";
    const sessionId = body?.session_id || null;

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

    const basePayload = pickPayload(platform, step, rotationMode, sessionId);
    const payload = injectDynamicContent(step, basePayload, {
      routedLink:
        resolvedLink?.finalUrl ||
        savedState?.link?.primary_link_url ||
        customerLink.baseAutoaffiLink ||
        null,
      destinationLabel:
        resolvedLink?.destinationLabel ||
        savedState?.link?.destination_label ||
        null,
      destinationPath:
        resolvedLink?.destinationPath ||
        savedState?.link?.destination_path ||
        null,
      destinationDescription:
        resolvedLink?.destinationDescription ||
        savedState?.link?.destination_description ||
        null,
      ctaType: selectedCtaType,
    });

    return NextResponse.json({
      ok: true,
      payload: {
        step,
        platform,
        variant_id: payload.id,
        rotation_key: `${platform}_${step}_${rotationMode}_${sessionId || "default"}`,
        title: payload.title,
        subtitle: payload.subtitle || "",
        instructions: payload.instructions || [],
        copy_blocks: payload.copy_blocks || [],
        completion_requirements: payload.completion_requirements || [],
      },
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
        error: error?.message || "Failed to generate profile connect step",
      },
      { status: 500 }
    );
  }
}