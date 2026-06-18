import { getBusinessDetails } from "./detailsService";
import type { NormalizedBusinessTarget } from "../types";

type GuidanceInput = {
  source: "places" | "registry";
  sourceId: string;
};

type OutreachGuidance = {
  found: boolean;
  targetId: string | null;
  target: NormalizedBusinessTarget | null;
  summary: {
    whyThisBusiness: string;
    goalOfFirstMessage: string;
    personalizationCue: string;
    personalizationPlaceholder: string;
    toneGuide: string;
    lengthGuide: string;
    ctaGuide: string;
  } | null;
  guidance: {
    do: string[];
    dont: string[];
  } | null;
  messages: {
    readyToSend: string;
    followUp1: string;
    followUp2: string;
    positiveReply: string;
    vagueReply: string;
    hardNoReply: string;
  } | null;
};

function normalizeCategory(category?: string) {
  return (category ?? "").trim().toLowerCase();
}

function normalizeName(name?: string) {
  return (name ?? "").trim();
}

function buildBusinessAngle(target: NormalizedBusinessTarget) {
  const category = normalizeCategory(target.category);
  const name = normalizeName(target.name);

  if (
    category.includes("restaurant") ||
    category.includes("bistro") ||
    category.includes("cafe") ||
    category.includes("bar") ||
    category.includes("fine dining") ||
    category.includes("seafood")
  ) {
    return {
      whyThisBusiness:
        `${name} looks like a business where stronger short-form visibility, repeat customer attention, and referral-driven growth could be valuable.`,
      personalizationCue:
        "Mention one specific thing you noticed, such as their atmosphere, reviews, menu style, or overall brand feeling.",
      personalizationPlaceholder:
        "[one specific detail you noticed about their atmosphere, reviews, menu style, or brand]",
    };
  }

  if (
    category.includes("hotel") ||
    category.includes("spa") ||
    category.includes("salon") ||
    category.includes("clinic") ||
    category.includes("fitness")
  ) {
    return {
      whyThisBusiness:
        `${name} looks like a business where trust, visibility, and a stronger flow of warm inbound interest could make outreach relevant.`,
      personalizationCue:
        "Mention one concrete business detail such as service presentation, customer impression, reviews, or brand positioning.",
      personalizationPlaceholder:
        "[one specific detail you noticed about their services, reviews, customer impression, or brand]",
    };
  }

  return {
    whyThisBusiness:
      `${name} appears to have enough public presence to justify a careful, value-first outreach angle focused on visibility and customer growth.`,
    personalizationCue:
      "Mention one real business-specific detail from their website, positioning, reviews, or public presence.",
    personalizationPlaceholder:
      "[one specific detail you noticed about their business, website, reviews, or public presence]",
  };
}

function buildDoList() {
  return [
    "Keep the first message short, calm, and easy to reply to.",
    "Show that you actually looked at the business before writing.",
    "Use the ready-made message below and only personalize one short business-specific detail so you do not have to overthink the outreach.",
  ];
}

function buildDontList() {
  return [
    "Do not include links or attachments in the first message.",
    "Do not sound like a mass message, aggressive pitch, or fake partnership request.",
    "Do not promise results, make exaggerated claims, or pressure them to act immediately.",
  ];
}

function buildToneGuide() {
  return "Professional, warm, respectful, low-pressure, and clearly human.";
}

function buildLengthGuide() {
  return "Keep the first message around 60–120 words and avoid long paragraphs.";
}

function buildGoalOfFirstMessage() {
  return "The goal of the first message is to start a conversation and get a reply, not to close the deal immediately.";
}

function buildCtaGuide() {
  return "End with a low-friction question that makes it easy to reply with yes, no, or curiosity.";
}

function buildReadyToSendMessage(
  target: NormalizedBusinessTarget,
  personalizationPlaceholder: string
) {
  const name = normalizeName(target.name);

  return `Hi ${name} team,

I came across your business and wanted to reach out because you already seem to have a strong foundation. I especially noticed ${personalizationPlaceholder}.

I work with simple growth and visibility ideas for businesses that want more consistent attention without making their outreach feel forced or spammy.

I do not want to overload you with a long pitch, but if helpful, I can send over 2 quick ideas that would fit your brand and customer flow.

Would you like me to send them here?`;
}

function buildFollowUp1(target: NormalizedBusinessTarget) {
  const name = normalizeName(target.name);

  return `Hi ${name} team,

Just following up in case my previous message got buried.

I had a couple of simple ideas in mind that could fit your business and help improve visibility in a way that still feels natural to your brand.

If useful, I can send them in a very short message here.`;
}

function buildFollowUp2(target: NormalizedBusinessTarget) {
  const name = normalizeName(target.name);

  return `Hi ${name} team,

I will keep this short.

I reached out because I felt there may be a genuine fit, but I completely understand if the timing is not right.

If you ever want, I can still send 2 short ideas tailored to ${name} and leave it there.`;
}

function buildPositiveReply() {
  return `Absolutely — I will keep it short.

Here are 2 quick ideas I believe could fit your business:

1. [Insert idea 1]
2. [Insert idea 2]

If either of these feels relevant, I can explain the next step in a simple way without making it complicated.`;
}

function buildVagueReply() {
  return `Of course.

To keep it simple, I can send just 2 short ideas tailored to your business and you can decide if either feels relevant. No pressure at all.`;
}

function buildHardNoReply() {
  return `Understood — thanks for the reply.

I appreciate the clarity, and I will not follow up again. Wishing you continued success.`;
}

export async function getOutreachGuidance(
  input: GuidanceInput
): Promise<OutreachGuidance> {
  const details = await getBusinessDetails({
    source: input.source,
    sourceId: input.sourceId,
  });

  if (!details.found || !details.target) {
    return {
      found: false,
      targetId: details.targetId,
      target: null,
      summary: null,
      guidance: null,
      messages: null,
    };
  }

  const target = details.target;
  const angle = buildBusinessAngle(target);

  const summary = {
    whyThisBusiness: angle.whyThisBusiness,
    goalOfFirstMessage: buildGoalOfFirstMessage(),
    personalizationCue: angle.personalizationCue,
    personalizationPlaceholder: angle.personalizationPlaceholder,
    toneGuide: buildToneGuide(),
    lengthGuide: buildLengthGuide(),
    ctaGuide: buildCtaGuide(),
  };

  const guidance = {
    do: buildDoList(),
    dont: buildDontList(),
  };

  const messages = {
    readyToSend: buildReadyToSendMessage(target, angle.personalizationPlaceholder),
    followUp1: buildFollowUp1(target),
    followUp2: buildFollowUp2(target),
    positiveReply: buildPositiveReply(),
    vagueReply: buildVagueReply(),
    hardNoReply: buildHardNoReply(),
  };

  return {
    found: true,
    targetId: details.targetId,
    target,
    summary,
    guidance,
    messages,
  };
}