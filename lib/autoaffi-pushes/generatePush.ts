import type {
  GeneratedPush,
  PushDay,
  PushInput,
} from "@/app/login/dashboard/autoaffi-pushes/types";
import { getPushTemplate } from "@/lib/autoaffi-pushes/push-templates";
import {
  buildAlgorithmNoteOverride,
  buildPushDayText,
  buildPushTitle,
  buildWhyThisPushWorks,
  createUniquenessContext,
} from "@/lib/autoaffi-pushes/push-variations";
import {
  getCTAStyleForDay,
  getPushRules,
  shouldPushClicks,
  shouldPushFollowers,
} from "@/lib/autoaffi-pushes/push-rules";

type DaySignature = string;

function buildDaySignature(day: PushDay): DaySignature {
  return JSON.stringify({
    hook: day.hook,
    body: day.body,
    cta: day.cta,
    commentReply: day.commentReply || "",
    imagePrompt: day.imagePrompt,
    videoScript: day.videoScript,
    hookFamily: (day as any).hookFamily || "",
    bodyFamily: (day as any).bodyFamily || "",
    ctaFamily: (day as any).ctaFamily || "",
    replyFamily: (day as any).commentReplyFamily || "",
    imagePromptFamily: (day as any).imagePromptFamily || "",
    videoScriptFamily: (day as any).videoScriptFamily || "",
  });
}

function buildSingleDay(
  input: PushInput,
  template: ReturnType<typeof getPushTemplate>[number],
  options?: { forceCommentCTA?: boolean }
): PushDay {
  const ctaStyle = getCTAStyleForDay({
    dayNumber: template.dayNumber,
    durationDays: input.durationDays,
    ctaIntensity: input.ctaIntensity,
    pushType: input.pushType,
  });

  const followerPush = shouldPushFollowers({
    goal: input.goal,
    pushType: input.pushType,
    dayNumber: template.dayNumber,
  });

  const clickPush = shouldPushClicks({
    goal: input.goal,
    dayNumber: template.dayNumber,
    durationDays: input.durationDays,
  });

  const uniqueness = createUniquenessContext();

  const content = buildPushDayText(
    {
      pushType: input.pushType,
      platform: input.platform,
      topic: input.topic,
      offerFocus: input.offerFocus,
      goal: input.goal,
      ctaIntensity: input.ctaIntensity,
      dayNumber: template.dayNumber,
      dayTitle: template.dayTitle,
      dayRole: template.dayRole,
      ctaStyle,
      shouldPushFollowers: followerPush,
      shouldPushClicks: clickPush,
      targetMarket: input.targetMarket,
      language: input.language,
      forceCommentCTA: options?.forceCommentCTA ?? false,
    },
    uniqueness
  );

  const overrideAlgorithmNote = buildAlgorithmNoteOverride({
    pushType: input.pushType,
    goal: input.goal,
    dayNumber: template.dayNumber,
  });

  return {
    dayNumber: template.dayNumber,
    dayTitle: template.dayTitle,
    dayRole: template.dayRole,
    whyThisDayMatters: template.whyThisDayMatters,
    optimizingFor: content.optimizingFor,
    hook: content.hook,
    body: content.body,
    cta: content.cta,
    commentReply: content.commentReply ?? null,
    algorithmNote: overrideAlgorithmNote ?? template.algorithmNote,
    hashtags: content.hashtags,
    keywordFocus: content.keywordFocus,
    imagePrompt: content.imagePrompt,
    videoScript: content.videoScript,
    ...(content.hookFamily ? { hookFamily: content.hookFamily } : {}),
    ...(content.bodyFamily ? { bodyFamily: content.bodyFamily } : {}),
    ...(content.ctaFamily ? { ctaFamily: content.ctaFamily } : {}),
    ...(content.imagePromptFamily
      ? { imagePromptFamily: content.imagePromptFamily }
      : {}),
    ...(content.videoScriptFamily
      ? { videoScriptFamily: content.videoScriptFamily }
      : {}),
    ...(content.commentReplyFamily
      ? { commentReplyFamily: content.commentReplyFamily }
      : {}),
  } as PushDay;
}

export function generateUniqueDayVariant(args: {
  input: PushInput;
  dayNumber: number;
  seenSignatures?: string[];
  requireCommentCTA?: boolean;
}): PushDay {
  const { input, dayNumber, seenSignatures = [], requireCommentCTA = false } = args;

  const templateDays = getPushTemplate(input.pushType, input.durationDays);
  const template = templateDays.find((d) => d.dayNumber === dayNumber);

  if (!template) {
    throw new Error(`Missing template for day ${dayNumber}`);
  }

  let fallback: PushDay | null = null;
  let fallbackWithComment: PushDay | null = null;

  for (let i = 0; i < 80; i += 1) {
    const candidate = buildSingleDay(input, template, {
      forceCommentCTA: requireCommentCTA,
    });
    const signature = buildDaySignature(candidate);
    const hasCommentCTA = /comment/i.test(candidate.cta);

    if (!fallback) fallback = candidate;
    if (hasCommentCTA && !fallbackWithComment) fallbackWithComment = candidate;

    const alreadySeen = seenSignatures.includes(signature);

    if (requireCommentCTA) {
      if (hasCommentCTA && !alreadySeen) {
        return candidate;
      }
    } else {
      if (!alreadySeen) {
        return candidate;
      }
    }
  }

  if (requireCommentCTA && fallbackWithComment) {
    return fallbackWithComment;
  }

  if (fallback) {
    return fallback;
  }

  return buildSingleDay(input, template);
}

export function generatePush(input: PushInput): GeneratedPush {
  const templateDays = getPushTemplate(input.pushType, input.durationDays);
  const rules = getPushRules({
    pushType: input.pushType,
    goal: input.goal,
    ctaIntensity: input.ctaIntensity,
    durationDays: input.durationDays,
  });

  const generationUniqueness = createUniquenessContext();

  const days: PushDay[] = templateDays.map((template) => {
    const ctaStyle = getCTAStyleForDay({
      dayNumber: template.dayNumber,
      durationDays: input.durationDays,
      ctaIntensity: input.ctaIntensity,
      pushType: input.pushType,
    });

    const followerPush = shouldPushFollowers({
      goal: input.goal,
      pushType: input.pushType,
      dayNumber: template.dayNumber,
    });

    const clickPush = shouldPushClicks({
      goal: input.goal,
      dayNumber: template.dayNumber,
      durationDays: input.durationDays,
    });

    const content = buildPushDayText(
      {
        pushType: input.pushType,
        platform: input.platform,
        topic: input.topic,
        offerFocus: input.offerFocus,
        goal: input.goal,
        ctaIntensity: input.ctaIntensity,
        dayNumber: template.dayNumber,
        dayTitle: template.dayTitle,
        dayRole: template.dayRole,
        ctaStyle,
        shouldPushFollowers: followerPush,
        shouldPushClicks: clickPush,
        targetMarket: input.targetMarket,
        language: input.language,
      },
      generationUniqueness
    );

    const overrideAlgorithmNote = buildAlgorithmNoteOverride({
      pushType: input.pushType,
      goal: input.goal,
      dayNumber: template.dayNumber,
    });

    return {
      dayNumber: template.dayNumber,
      dayTitle: template.dayTitle,
      dayRole: template.dayRole,
      whyThisDayMatters: template.whyThisDayMatters,
      optimizingFor: content.optimizingFor,
      hook: content.hook,
      body: content.body,
      cta: content.cta,
      commentReply: content.commentReply ?? null,
      algorithmNote: overrideAlgorithmNote ?? template.algorithmNote,
      hashtags: content.hashtags,
      keywordFocus: content.keywordFocus,
      imagePrompt: content.imagePrompt,
      videoScript: content.videoScript,
      ...(content.hookFamily ? { hookFamily: content.hookFamily } : {}),
      ...(content.bodyFamily ? { bodyFamily: content.bodyFamily } : {}),
      ...(content.ctaFamily ? { ctaFamily: content.ctaFamily } : {}),
      ...(content.imagePromptFamily
        ? { imagePromptFamily: content.imagePromptFamily }
        : {}),
      ...(content.videoScriptFamily
        ? { videoScriptFamily: content.videoScriptFamily }
        : {}),
      ...(content.commentReplyFamily
        ? { commentReplyFamily: content.commentReplyFamily }
        : {}),
    } as PushDay;
  });

  const title = buildPushTitle(input.pushType, input.topic);
  const whyThisPushWorks = buildWhyThisPushWorks({
    pushType: input.pushType,
    goal: input.goal,
    topic: input.topic,
    offerFocus: input.offerFocus,
  });

  return {
    title,
    pushType: input.pushType,
    platform: input.platform,
    topic: input.topic,
    offerFocus: input.offerFocus,
    goal: input.goal,
    durationDays: input.durationDays,
    ctaIntensity: input.ctaIntensity,
    targetMarket: input.targetMarket,
    language: input.language,
    whyThisPushWorks: rules.preferTrustBeforeConversion
      ? `${whyThisPushWorks} It is intentionally structured to build trust and stronger algorithm signals before heavier conversion pressure.`
      : whyThisPushWorks,
    days,
  };
}