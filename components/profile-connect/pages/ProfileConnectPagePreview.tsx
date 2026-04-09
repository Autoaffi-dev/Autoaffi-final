"use client";

import LeadPageBound from "./lead/LeadPageBound";
import BridgeIntroPageBound from "./bridge/BridgeIntroPageBound";
import BridgeConnectionPageBound from "./bridge/BridgeConnectionPageBound";
import BridgePremiumPageBound from "./bridge/BridgePremiumPageBound";

type PreviewMode = "lead" | "bridge";
type BridgeStep = "intro" | "connection" | "premium";

type ProfileConnectStateLike = {
  slug?: string;

  positioning?: {
    display_name?: string;
    one_liner?: string;
  };

  bio?: {
    selected_text?: string;
  };

  photo?: {
    ready_image_choice?: string;
    image_style?: "personal" | "faceless" | "ready_made";
  };

  connection?: {
    headline?: string;
    subheadline?: string;
    who_i_am_title?: string;
    who_i_am_text?: string;
    what_i_believe_title?: string;
    what_i_believe_text?: string;
    why_i_share_title?: string;
    why_i_share_text?: string;
    if_you_are_like_me_title?: string;
    if_you_are_like_me_points?: string[];
    tone?: "calm" | "premium" | "driven" | "friendly";
    audience?: string;
    personal_values?: string[];
    why_story?: string;
    belief_statement?: string;
  };

  proof?: {
    trust_mode?: "simple" | "authority" | "soft";
  };

  lead?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
  };

  premium?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
  };

  offer?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
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
  mode?: PreviewMode;
  bridgeStep?: BridgeStep;
  onGuideClick?: () => void;
  onStoryClick?: () => void;
  onContinueClick?: () => void;
  onPremiumClick?: () => void;
  onBackToGuideClick?: () => void;
};

function deriveMode(
  explicitMode: PreviewMode | undefined,
  stepState: ProfileConnectStateLike
): PreviewMode {
  if (explicitMode) return explicitMode;
  return (stepState?.link?.primary_link_type || "lead") as PreviewMode;
}

export default function ProfileConnectPagePreview({
  stepState,
  mode,
  bridgeStep = "intro",
  onGuideClick,
  onStoryClick,
  onContinueClick,
  onPremiumClick,
  onBackToGuideClick,
}: Props) {
  const resolvedMode = deriveMode(mode, stepState);

  if (resolvedMode === "lead") {
    return (
      <LeadPageBound
        stepState={stepState}
        onPrimaryClick={onGuideClick}
      />
    );
  }

  if (bridgeStep === "connection") {
    return (
      <BridgeConnectionPageBound
        stepState={stepState}
        onContinueClick={onContinueClick}
        onGuideClick={onBackToGuideClick || onGuideClick}
      />
    );
  }

  if (bridgeStep === "premium") {
    return (
      <BridgePremiumPageBound
        stepState={stepState}
        onPrimaryClick={onPremiumClick}
        onSecondaryClick={onBackToGuideClick || onGuideClick}
      />
    );
  }

  return (
    <BridgeIntroPageBound
      stepState={stepState}
      onGuideClick={onGuideClick}
      onStoryClick={onStoryClick}
    />
  );
}
