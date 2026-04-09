"use client";

import BridgeIntroPageShell from "./BridgeIntroPageShell";
import { buildConnectionProfile } from "@/lib/profile-connect/engine/buildConnectionProfile";

type ProfileConnectStateLike = {
  slug?: string;
  token?: string;
  user_id?: string;
  autoaffi_user_code?: string;

  positioning?: {
    display_name?: string;
    one_liner?: string;
    own_name?: string;
    brand_name?: string;
    auto_detected_name?: string;
  };

  profile?: {
    id?: string;
    name?: string;
    full_name?: string;
    display_name?: string;
    email?: string;
  };

  user?: {
    id?: string;
    name?: string;
    full_name?: string;
    email?: string;
  };

  session?: {
    user?: {
      id?: string;
      name?: string;
      full_name?: string;
      email?: string;
    };
  };

  account?: {
    name?: string;
    full_name?: string;
    email?: string;
  };

  email?: string;

  bio?: {
    selected_text?: string;
  };

  photo?: {
    ready_image_choice?: string;
    image_style?: "personal" | "faceless" | "ready_made";
    generated_image_url?: string;
    uploaded_image_url?: string;
    image_url?: string;
  };

  bridge?: {
    image_url?: string;
    title?: string;
    subtitle?: string;
  };

  connection?: {
    headline?: string;
    subheadline?: string;
    who_i_am_text?: string;
    why_i_share_text?: string;
    belief_statement?: string;
  };

  link?: {
    primary_link_type?: "lead" | "bridge";
    primary_link_url?: string | null;
    destination_path?: string | null;
  };

  [key: string]: any;
};

type Props = {
  stepState: ProfileConnectStateLike;
  onGuideClick?: () => void;
  onStoryClick?: () => void;
};

function cleanSeed(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function deriveGenerated(stepState: ProfileConnectStateLike) {
  return buildConnectionProfile(stepState as any);
}

function deriveCreatorName(stepState: ProfileConnectStateLike) {
  const generated = deriveGenerated(stepState);
  return generated.creatorName || "Your Creator";
}

function deriveHeadline(stepState: ProfileConnectStateLike) {
  const generated = deriveGenerated(stepState);
  const explicit = cleanSeed(stepState?.bridge?.title || "");

  if (explicit) return explicit;

  return (
    cleanSeed(stepState?.connection?.headline || "") ||
    generated.connectionHeadline ||
    "A more personal look at my path, perspective and next step"
  );
}

function deriveIntro(stepState: ProfileConnectStateLike) {
  const explicit = cleanSeed(stepState?.bridge?.subtitle || "");
  if (explicit) {
    return explicit;
  }

  const creatorName =
    cleanSeed(stepState?.positioning?.display_name || "") ||
    cleanSeed(stepState?.profile?.display_name || "") ||
    cleanSeed(stepState?.profile?.name || "") ||
    cleanSeed(stepState?.user?.name || "") ||
    "I";

  return `${creatorName} built this because many people have the motivation to succeed, but never get the right structure, support or guidance to make real progress. Autoaffi is designed to make the path clearer, simpler and more practical, so you have a better chance to move forward, stay consistent and build something real instead of trying to figure everything out alone.`;
}

/**
 * IMPORTANT:
 * Bridge public page should NOT reuse ordinary profile-photo logic as the main hero.
 * Only use an explicitly chosen bridge image if one exists.
 * Otherwise pass empty string so the shell/hero can use a unique Autoaffi beast variant.
 */
function deriveBridgeHeroImage(stepState: ProfileConnectStateLike) {
  return "";
}

function deriveVariantSeed(
  stepState: ProfileConnectStateLike,
  creatorName: string
) {
  const candidates = [
    stepState?.user_id,
    stepState?.profile?.id,
    stepState?.user?.id,
    stepState?.session?.user?.id,
    stepState?.autoaffi_user_code,
    stepState?.slug,
    stepState?.token,
    stepState?.profile?.email,
    stepState?.user?.email,
    stepState?.session?.user?.email,
    stepState?.email,
    creatorName,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  return candidates[0] || "autoaffi-bridge-default";
}

export default function BridgeIntroPageBound({
  stepState,
  onGuideClick,
  onStoryClick,
}: Props) {
  const creatorName = deriveCreatorName(stepState);
  const creatorHeadline = deriveHeadline(stepState);
  const creatorIntro = deriveIntro(stepState);
  const imageUrl = deriveBridgeHeroImage(stepState);
  const variantSeed = deriveVariantSeed(stepState, creatorName);

  return (
    <BridgeIntroPageShell
      creatorName={creatorName}
      creatorHeadline={creatorHeadline}
      creatorIntro={creatorIntro}
      imageUrl={imageUrl}
      variantSeed={variantSeed}
      onGuideClick={onGuideClick}
      onStoryClick={onStoryClick}
    />
  );
}
