import type { PlatformKey } from "./types";

type ExportKitSection = {
  id: string;
  label: string;
  paste_target: string;
  helper: string;
  text: string;
};

export type ExportKit = {
  platform: PlatformKey;
  title: string;
  summary: string;
  sections: ExportKitSection[];
};

function safe(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function buildExportKit(params: {
  platform: PlatformKey;
  stepState: any;
}): ExportKit {
  const { platform, stepState } = params;

  const displayName =
    safe(stepState?.positioning?.display_name) || "No profile name saved yet.";

  const positioning =
    safe(stepState?.positioning?.one_liner) || "No positioning line saved yet.";

  const finalBio =
    safe(stepState?.bio?.selected_text) ||
    safe(stepState?.final_bio) ||
    "No bio saved yet.";

  const primaryLink =
    safe(stepState?.link?.primary_link_url) ||
    safe(stepState?.primary_link_url) ||
    "No primary link saved yet.";

  const ctaLine =
    safe(stepState?.link?.cta_line) || "No CTA line saved yet.";

  const ctaType = safe(stepState?.cta?.cta_type) || "Not selected";
  const ctaKeyword = safe(stepState?.cta?.cta_keyword) || "START";

  const quickReply1 = safe(stepState?.cta?.quick_reply_1) || "Not saved yet.";
  const quickReply2 = safe(stepState?.cta?.quick_reply_2) || "Not saved yet.";
  const quickReply3 = safe(stepState?.cta?.quick_reply_3) || "Not saved yet.";
  const followUp = safe(stepState?.cta?.follow_up) || "Not saved yet.";
  const pinnedComment = safe(stepState?.cta?.pinned_comment) || "Not saved yet.";

  const pin1 = safe(stepState?.pinned?.pin1_text) || "Not saved yet.";
  const pin2 = safe(stepState?.pinned?.pin2_text) || "Not saved yet.";
  const pin3 = safe(stepState?.pinned?.pin3_text) || "Not saved yet.";

  const proofSummary =
    safe(stepState?.proof?.summary) ||
    "Proof layer not saved yet.";

  const imageStyle = safe(stepState?.photo?.image_style) || "Not selected";
  const imagePrompt = safe(stepState?.photo?.prompt) || "No prompt saved.";
  const imageChoice = safe(stepState?.photo?.ready_image_choice) || "No ready-made image selected.";

  const sections: ExportKitSection[] = [
    {
      id: "profile_name",
      label: "Profile Name",
      paste_target: "Paste into your profile name field",
      helper: "Use this as the visible name/title on your profile.",
      text: displayName,
    },
    {
      id: "positioning",
      label: "Positioning Line",
      paste_target: "Paste into your profile headline / one-liner area",
      helper: "Use this wherever the platform lets you explain what your page is about.",
      text: positioning,
    },
    {
      id: "bio",
      label: "Bio",
      paste_target: "Paste into your bio field",
      helper: "Copy this exactly into your platform bio.",
      text: finalBio,
    },
    {
      id: "primary_link",
      label: "Primary Link",
      paste_target: "Paste into your website / link field",
      helper: "Use this as your main tracked link or chosen funnel link.",
      text: primaryLink,
    },
    {
      id: "cta_line",
      label: "Link CTA",
      paste_target: "Use in captions, bio CTA or pinned text",
      helper: "This is the short CTA line that supports your link.",
      text: ctaLine,
    },
    {
      id: "proof_layer",
      label: "Proof Package",
      paste_target: "Use for highlights, proof stories, pinned trust content or featured assets",
      helper: "This is your trust-building proof direction.",
      text: proofSummary,
    },
    {
      id: "pin_1",
      label: "Pinned Asset 1",
      paste_target: "Use for your first pinned post / video / featured asset",
      helper: "This is your START asset.",
      text: pin1,
    },
    {
      id: "pin_2",
      label: "Pinned Asset 2",
      paste_target: "Use for your second pinned post / video / featured asset",
      helper: "This is your PROOF asset.",
      text: pin2,
    },
    {
      id: "pin_3",
      label: "Pinned Asset 3",
      paste_target: "Use for your third pinned post / video / featured asset",
      helper: "This is your OFFER asset.",
      text: pin3,
    },
    {
      id: "quick_reply_1",
      label: "Quick Reply 1",
      paste_target: "Paste into your quick reply / saved reply",
      helper: "Use this when someone first responds.",
      text: quickReply1,
    },
    {
      id: "quick_reply_2",
      label: "Quick Reply 2",
      paste_target: "Paste into your quick reply / saved reply",
      helper: "Use this as the follow-up qualification message.",
      text: quickReply2,
    },
    {
      id: "quick_reply_3",
      label: "Quick Reply 3",
      paste_target: "Paste into your quick reply / saved reply",
      helper: "Use this when sending the final action step.",
      text: quickReply3,
    },
    {
      id: "follow_up",
      label: "Follow-up Message",
      paste_target: "Paste into your saved follow-up message",
      helper: "Use this if the lead does not reply immediately.",
      text: followUp,
    },
    {
      id: "pinned_comment",
      label: "Pinned Comment / Public CTA",
      paste_target: "Paste into your pinned comment or public CTA area",
      helper: "Use this in comments, captions or pinned CTA placements.",
      text: pinnedComment,
    },
    {
      id: "profile_image",
      label: "Profile Image Setup",
      paste_target: "Use for your profile image choice",
      helper: "If using your own photo, ignore prompt/image below. Otherwise use the selected prompt or ready-made image.",
      text:
        `Style: ${imageStyle}\n` +
        `Prompt: ${imagePrompt}\n` +
        `Ready-made image: ${imageChoice}`,
    },
    {
      id: "cta_system_summary",
      label: "CTA System Summary",
      paste_target: "Use across your bio, comments, replies and captions",
      helper: "Keep this logic consistent everywhere on the platform.",
      text:
        `CTA Type: ${ctaType}\n` +
        `CTA Keyword: ${ctaKeyword}\n` +
        `Primary Link: ${primaryLink}`,
    },
  ];

  return {
    platform,
    title: `Profile Setup Final Kit — ${platform}`,
    summary:
      "Everything below is ready to copy and paste. Autoaffi already prepared the exact setup for you.",
    sections,
  };
}