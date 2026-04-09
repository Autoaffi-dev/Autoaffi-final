import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

import { authOptions } from "@/lib/authOptions";
import { buildExportKit } from "@/lib/profile-connect/engine/export-kit";
import { getCustomerAutoaffiLink } from "@/lib/profile-connect/engine/getCustomerAutoaffiLink";
import { resolveProfileConnectLink } from "@/lib/profile-connect/engine/resolveProfileConnectLink";

export const runtime = "nodejs";

type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";
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

    const customerLink = await getCustomerAutoaffiLink({
      userId,
      profilePlatform: platform,
      recurringPlatformKey: "autoaffi",
      supabase,
    });

    const selectedMode = (savedState?.link?.primary_link_type || "lead") as LinkType;
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

    const hydratedState = {
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

    const exportKit = buildExportKit({
      platform,
      stepState: hydratedState,
    });

    return NextResponse.json({
      ok: true,
      platform,
      export_kit: exportKit,
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
        error: error?.message || "Failed to build export kit",
      },
      { status: 500 }
    );
  }
}
