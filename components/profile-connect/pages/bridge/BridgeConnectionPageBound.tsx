"use client";

import BridgeConnectionPageShell from "./BridgeConnectionPageShell";
import { buildConnectionProfile } from "@/lib/profile-connect/engine/buildConnectionProfile";

type ProfileConnectStateLike = {
  slug?: string;
  token?: string;

  positioning?: {
    display_name?: string;
    one_liner?: string;
    own_name?: string;
    brand_name?: string;
    auto_detected_name?: string;
  };

  photo?: {
    ready_image_choice?: string;
    image_style?: "personal" | "faceless" | "ready_made";
    generated_image_url?: string;
    uploaded_image_url?: string;
    image_url?: string;
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
    image_url?: string;
  };

  proof?: {
    trust_mode?: "simple" | "authority" | "soft";
  };

  bio?: {
    selected_text?: string;
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
  onContinueClick?: () => void;
  onGuideClick?: () => void;
};

function cleanSeed(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * IMPORTANT:
 * Story page should not default to profile-photo logic as the hero.
 * Only use an explicitly chosen story/connection image if it really exists.
 * Otherwise let the shell use its own premium fallback / beast handling.
 */
function deriveImage(stepState: ProfileConnectStateLike) {
  return cleanSeed(
    stepState?.connection?.image_url ||
      stepState?.photo?.generated_image_url ||
      ""
  );
}

function deriveVariantSeed(
  stepState: ProfileConnectStateLike,
  creatorName: string
) {
  const candidates = [
    stepState?.slug,
    stepState?.token,
    stepState?.positioning?.display_name,
    stepState?.positioning?.own_name,
    stepState?.positioning?.brand_name,
    stepState?.positioning?.auto_detected_name,
    creatorName,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  return candidates[0] || "autoaffi-story-default";
}

export default function BridgeConnectionPageBound({
  stepState,
  onContinueClick,
  onGuideClick,
}: Props) {
  const generated = buildConnectionProfile(stepState as any);
  const creatorImageUrl = deriveImage(stepState);

  const creatorName =
    cleanSeed(
      stepState?.positioning?.display_name ||
        stepState?.positioning?.own_name ||
        stepState?.positioning?.brand_name ||
        stepState?.positioning?.auto_detected_name ||
        generated.creatorName ||
        "Me"
    ) || "Me";

  const variantSeed = deriveVariantSeed(stepState, creatorName);

  const connectionHeadline =
    cleanSeed(stepState?.connection?.headline || "") ||
    generated.connectionHeadline ||
    "A more personal look at why I believe this path can work better";

  const connectionSubheadline =
    cleanSeed(stepState?.connection?.subheadline || "") ||
    `${creatorName} wanted something that felt clearer, more realistic and easier to trust. That is a big part of why this path feels worth sharing with people who want a calmer, smarter and more supportive way forward.`;

  const whoIAmTitle =
    cleanSeed(stepState?.connection?.who_i_am_title || "") ||
    "Why this became personal for me";

  const whoIAmText =
    cleanSeed(stepState?.connection?.who_i_am_text || "") ||
    `I know how frustrating it can feel to want more in life, but still feel like you are standing still. Not because you do not care, and not because you are not willing to try, but because everything around you feels unclear, scattered and harder than it should be. That is something I have thought about a lot. I have seen how many people lose time, energy and confidence simply because they never get a path that feels clear enough to follow. Over time, that made this feel personal to me. What pulled me toward Autoaffi was not just the idea of a platform. It was the feeling that this could become something that actually helps people in a more human way. Something that gives structure where there is usually confusion, and something that makes the path feel possible again.`;

  const whatIBelieveTitle =
    cleanSeed(stepState?.connection?.what_i_believe_title || "") ||
    "What made me believe in this instead";

  const whatIBelieveText =
    cleanSeed(
      stepState?.connection?.what_i_believe_text ||
        stepState?.connection?.belief_statement ||
        ""
    ) ||
    `I did not want to put my energy behind something that only looked exciting on the surface. I wanted something that could genuinely make it easier for people to move forward. What I liked here was that it felt like a smarter and more supportive way to help someone build progress. Less chaos. Less guessing. Less feeling like you have to figure out everything alone. More clarity. More direction. More chance to actually keep going when life gets busy or motivation drops. That matters to me, because I do not think most people need more pressure. I think they need a better setup — one that makes success feel more realistic instead of more distant.`;

  const whyIShareTitle =
    cleanSeed(stepState?.connection?.why_i_share_title || "") ||
    "Why I want to share this with people";

  const whyIShareText =
    cleanSeed(stepState?.connection?.why_i_share_text || "") ||
    `I want to share this because I know there are people out there who are capable of much more than their current situation shows. Sometimes they do not need a miracle. They need the right path, the right structure and the feeling that they are not doing everything alone. That is what I want this to be about. Not hype. Not empty promises. Not pretending everything is easy. Just a better chance. A clearer path. And a more supportive way for someone to build something real over time. If this can help even one person feel more hope, more direction and more belief in what is possible, then that matters to me. That is why this is worth sharing.`;

  const ifYouAreLikeMeTitle =
    cleanSeed(stepState?.connection?.if_you_are_like_me_title || "") ||
    "This may connect with you if...";

  const ifYouAreLikeMePoints =
    stepState?.connection?.if_you_are_like_me_points?.length
      ? stepState.connection.if_you_are_like_me_points
      : [
          "You feel like you have more potential than your current results show",
          "You are tired of trying to figure everything out alone",
          "You want a path that feels clearer, calmer and more realistic",
          "You want support, structure and a better chance to actually keep going",
        ];

  return (
    <BridgeConnectionPageShell
      creatorName={creatorName}
      creatorImageUrl={creatorImageUrl}
      creatorImageAlt={`${creatorName} connection page`}
      variantSeed={variantSeed}
      connectionHeadline={connectionHeadline}
      connectionSubheadline={connectionSubheadline}
      whoIAmTitle={whoIAmTitle}
      whoIAmText={whoIAmText}
      whatIBelieveTitle={whatIBelieveTitle}
      whatIBelieveText={whatIBelieveText}
      whyIShareTitle={whyIShareTitle}
      whyIShareText={whyIShareText}
      ifYouAreLikeMeTitle={ifYouAreLikeMeTitle}
      ifYouAreLikeMePoints={ifYouAreLikeMePoints}
      onContinueClick={onContinueClick}
      onGuideClick={onGuideClick}
    />
  );
}