"use client";

import BridgePremiumPageShell from "./BridgePremiumPageShell";

type ProfileConnectStateLike = {
  slug?: string;

  positioning?: {
    display_name?: string;
  };

  premium?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
  };

  link?: {
    destination_label?: string | null;
    primary_link_type?: "lead" | "bridge";
    primary_link_url?: string | null;
    destination_path?: string | null;
  };

  offer?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
  };

  [key: string]: any;
};

type Props = {
  stepState: ProfileConnectStateLike;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
};

function deriveCreatorName(stepState: ProfileConnectStateLike) {
  return stepState?.positioning?.display_name || "Your Creator";
}

function deriveTitle(stepState: ProfileConnectStateLike) {
  return (
    stepState?.premium?.title ||
    stepState?.offer?.title ||
    "The premium setup I recommend for a clearer and smarter path forward"
  );
}

function deriveSubtitle(stepState: ProfileConnectStateLike) {
  return (
    stepState?.premium?.subtitle ||
    stepState?.offer?.subtitle ||
    "Built for people who want better tools, simpler systems and a more serious next step."
  );
}

function deriveImage(stepState: ProfileConnectStateLike) {
  return (
    stepState?.premium?.image_url ||
    stepState?.offer?.image_url ||
    "/images/profile-connect/bridge-premium-hero.jpg"
  );
}

function deriveBullets(stepState: ProfileConnectStateLike) {
  const fromPremium = stepState?.premium?.bullets;
  const fromOffer = stepState?.offer?.bullets;

  if (fromPremium?.length) return fromPremium;
  if (fromOffer?.length) return fromOffer;

  return [
    "A clearer workflow that feels easier to follow",
    "A more structured way to move forward",
    "Better-fit tools instead of random trial and error",
    "A stronger premium next step when you are ready",
  ];
}

function deriveFitBullets(stepState: ProfileConnectStateLike) {
  const fromPremium = stepState?.premium?.fit_bullets;
  const fromOffer = stepState?.offer?.fit_bullets;

  if (fromPremium?.length) return fromPremium;
  if (fromOffer?.length) return fromOffer;

  return [
    "People who want a clearer structure",
    "Creators who want better-fit tools",
    "Anyone who wants less noise and better direction",
    "People ready for a more serious next step",
  ];
}

export default function BridgePremiumPageBound({
  stepState,
  onPrimaryClick,
  onSecondaryClick,
}: Props) {
  const creatorName = deriveCreatorName(stepState);
  const premiumTitle = deriveTitle(stepState);
  const premiumSubtitle = deriveSubtitle(stepState);
  const premiumImageUrl = deriveImage(stepState);
  const premiumBullets = deriveBullets(stepState);
  const fitBullets = deriveFitBullets(stepState);

  return (
    <BridgePremiumPageShell
      creatorName={creatorName}
      premiumTitle={premiumTitle}
      premiumSubtitle={premiumSubtitle}
      premiumImageUrl={premiumImageUrl}
      premiumImageAlt={`${creatorName} premium recommendation`}
      premiumBullets={premiumBullets}
      fitBullets={fitBullets}
      onPrimaryClick={onPrimaryClick}
      onSecondaryClick={onSecondaryClick}
    />
  );
}