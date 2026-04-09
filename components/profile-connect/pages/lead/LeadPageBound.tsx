"use client";

import LeadPageShell from "./LeadPageShell";

type ProfileConnectStateLike = {
  token?: string;
  slug?: string;
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

  lead?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    video_url?: string;
    video_title?: string;
    video_subtitle?: string;
  };

  connection?: {
    subheadline?: string;
    why_i_share_text?: string;
    who_i_am_text?: string;
    belief_statement?: string;
  };

  link?: {
    primary_link_type?: "lead" | "bridge";
    primary_link_url?: string | null;
    destination_path?: string | null;
    destination_label?: string | null;
  };

  [key: string]: any;
};

type Props = {
  stepState: ProfileConnectStateLike;
  onPrimaryClick?: () => void;
};

function cleanSeed(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  return cleanSeed(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function emailLocalToName(email: string) {
  const local = email.split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCase(cleaned);
}

function deriveCreatorName(stepState: ProfileConnectStateLike) {
  const directCandidates = [
    stepState?.positioning?.display_name,
    stepState?.positioning?.own_name,
    stepState?.positioning?.brand_name,
    stepState?.positioning?.auto_detected_name,
    stepState?.profile?.full_name,
    stepState?.profile?.name,
    stepState?.profile?.display_name,
    stepState?.user?.full_name,
    stepState?.user?.name,
    stepState?.session?.user?.full_name,
    stepState?.session?.user?.name,
    stepState?.account?.full_name,
    stepState?.account?.name,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  if (directCandidates.length > 0) {
    return toTitleCase(directCandidates[0]);
  }

  const emailCandidates = [
    stepState?.profile?.email,
    stepState?.user?.email,
    stepState?.session?.user?.email,
    stepState?.account?.email,
    stepState?.email,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  if (emailCandidates.length > 0) {
    const derived = emailLocalToName(emailCandidates[0]);
    if (derived) return derived;
  }

  return "Your Creator";
}

function deriveGuideTitle(stepState: ProfileConnectStateLike) {
  const explicit = cleanSeed(stepState?.lead?.title || "");
  if (explicit) return explicit;

  return "Start with a simpler first step that feels easier to trust";
}

function deriveGuideSubtitle(stepState: ProfileConnectStateLike) {
  const explicit = cleanSeed(stepState?.lead?.subtitle || "");
  if (explicit) {
    return explicit.length > 190 ? `${explicit.slice(0, 187)}...` : explicit;
  }

  return "This page is here to help you understand the path more clearly, see what may fit you better, and take a calmer first step before moving forward.";
}

/**
 * IMPORTANT:
 * Public lead page should NOT use explicit uploaded/generated lead images right now.
 * We let LeadPageShell choose from the safe lead pool via variantSeed instead.
 */
function deriveLeadHeroImage(stepState: ProfileConnectStateLike) {
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

  return candidates[0] || "autoaffi-default";
}

function deriveVideoUrl(stepState: ProfileConnectStateLike) {
  return cleanSeed(stepState?.lead?.video_url || "");
}

function deriveVideoTitle(stepState: ProfileConnectStateLike) {
  return cleanSeed(stepState?.lead?.video_title || "") || "See how Autoaffi works";
}

function deriveVideoSubtitle(stepState: ProfileConnectStateLike) {
  return (
    cleanSeed(stepState?.lead?.video_subtitle || "") ||
    "Video can be added here later as the next step after the lead form."
  );
}

export default function LeadPageBound({
  stepState,
  onPrimaryClick,
}: Props) {
  const creatorName = deriveCreatorName(stepState);
  const guideTitle = deriveGuideTitle(stepState);
  const guideSubtitle = deriveGuideSubtitle(stepState);
  const imageUrl = deriveLeadHeroImage(stepState);
  const variantSeed = deriveVariantSeed(stepState, creatorName);

  const videoUrl = deriveVideoUrl(stepState);
  const videoTitle = deriveVideoTitle(stepState);
  const videoSubtitle = deriveVideoSubtitle(stepState);

  return (
    <LeadPageShell
      creatorName={creatorName}
      guideTitle={guideTitle}
      guideSubtitle={guideSubtitle}
      imageUrl={imageUrl}
      variantSeed={variantSeed}
      videoUrl={videoUrl}
      videoTitle={videoTitle}
      videoSubtitle={videoSubtitle}
      onPrimaryClick={onPrimaryClick}
    />
  );
}