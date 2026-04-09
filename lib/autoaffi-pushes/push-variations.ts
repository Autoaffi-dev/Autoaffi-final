import type {
  DayOptimizationFocus,
  PushCTAIntensity,
  PushGoal,
  PushLanguage,
  PushPlatform,
  PushTargetMarket,
  PushType,
} from "@/app/login/dashboard/autoaffi-pushes/types";

type BuildDayTextArgs = {
  pushType: PushType;
  platform: PushPlatform;
  topic: string;
  offerFocus?: string;
  goal: PushGoal;
  ctaIntensity: PushCTAIntensity;
  dayNumber: number;
  dayTitle: string;
  dayRole: string;
  ctaStyle: "none" | "soft" | "medium" | "direct";
  shouldPushFollowers: boolean;
  shouldPushClicks: boolean;
  targetMarket: PushTargetMarket;
  language: PushLanguage;
  forceCommentCTA?: boolean;
};

type Variant = {
  id: string;
  family: string;
  value: string;
};

type VariantArray = {
  id: string;
  family: string;
  value: string[];
};

export type PushUniquenessContext = {
  usedHooks: Set<string>;
  usedHookFamilies: Set<string>;
  usedBodies: Set<string>;
  usedBodyFamilies: Set<string>;
  usedCTAs: Set<string>;
  usedCTAFamilies: Set<string>;
  usedReplies: Set<string>;
  usedReplyFamilies: Set<string>;
  usedImagePrompts: Set<string>;
  usedImagePromptFamilies: Set<string>;
  usedVideoScripts: Set<string>;
  usedVideoScriptFamilies: Set<string>;
};

export type BuiltDayContent = {
  hook: string;
  hookFamily: string;
  body: string;
  bodyFamily: string;
  cta: string;
  ctaFamily: string;
  commentReply: string | null;
  commentReplyFamily: string | null;
  hashtags: string[];
  keywordFocus: string[];
  imagePrompt: string;
  imagePromptFamily: string;
  videoScript: string[];
  videoScriptFamily: string;
  optimizingFor: DayOptimizationFocus[];
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function platformLabel(platform: PushPlatform) {
  switch (platform) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "youtube":
      return "YouTube Shorts";
    default:
      return "social";
  }
}

function marketLabel(targetMarket: PushTargetMarket) {
  switch (targetMarket) {
    case "usa":
      return "USA";
    case "canada":
      return "Canada";
    case "uk":
      return "UK";
    case "australia":
      return "Australia";
    case "new_zealand":
      return "New Zealand";
    default:
      return "international English-speaking";
  }
}

function pickVariant(
  variants: Variant[],
  usedValues: Set<string>,
  usedFamilies: Set<string>
): Variant {
  const unusedFamily = variants.filter(
    (variant) =>
      !usedFamilies.has(variant.family) && !usedValues.has(variant.value)
  );

  if (unusedFamily.length > 0) {
    const picked = randomItem(unusedFamily);
    usedValues.add(picked.value);
    usedFamilies.add(picked.family);
    return picked;
  }

  const unusedValue = variants.filter((variant) => !usedValues.has(variant.value));
  if (unusedValue.length > 0) {
    const picked = randomItem(unusedValue);
    usedValues.add(picked.value);
    usedFamilies.add(picked.family);
    return picked;
  }

  const picked = randomItem(variants);
  usedValues.add(picked.value);
  usedFamilies.add(picked.family);
  return picked;
}

function pickVariantArray(
  variants: VariantArray[],
  usedValues: Set<string>,
  usedFamilies: Set<string>
): VariantArray {
  const withKeys = variants.map((variant) => ({
    ...variant,
    valueKey: variant.value.join(" || "),
  }));

  const unusedFamily = withKeys.filter(
    (variant) =>
      !usedFamilies.has(variant.family) && !usedValues.has(variant.valueKey)
  );

  if (unusedFamily.length > 0) {
    const picked = randomItem(unusedFamily);
    usedValues.add(picked.valueKey);
    usedFamilies.add(picked.family);
    return { id: picked.id, family: picked.family, value: picked.value };
  }

  const unusedValue = withKeys.filter((variant) => !usedValues.has(variant.valueKey));
  if (unusedValue.length > 0) {
    const picked = randomItem(unusedValue);
    usedValues.add(picked.valueKey);
    usedFamilies.add(picked.family);
    return { id: picked.id, family: picked.family, value: picked.value };
  }

  const picked = randomItem(withKeys);
  usedValues.add(picked.valueKey);
  usedFamilies.add(picked.family);
  return { id: picked.id, family: picked.family, value: picked.value };
}

function hookCandidates(args: BuildDayTextArgs): Variant[] {
  const topic = args.topic.trim();

  const map: Record<string, Variant[]> = {
    "Pattern interrupt": [
      {
        id: "hook_pattern_backwards",
        family: "pattern_backwards",
        value: `Most people are doing ${topic} backwards.`,
      },
      {
        id: "hook_pattern_stuck_reason",
        family: "pattern_stuck_reason",
        value: `This is why so many people stay stuck with ${topic}.`,
      },
      {
        id: "hook_pattern_hard_reason",
        family: "pattern_hard_reason",
        value: `If ${topic} still feels hard, this is probably the reason.`,
      },
      {
        id: "hook_pattern_wrong_order",
        family: "pattern_wrong_order",
        value: `The order most people use in ${topic} is exactly what slows them down.`,
      },
      {
        id: "hook_pattern_scroll_truth",
        family: "pattern_scroll_truth",
        value: `The uncomfortable truth about ${topic} starts here.`,
      },
      {
        id: "hook_pattern_common_miss",
        family: "pattern_common_miss",
        value: `Almost everyone misses this first step in ${topic}.`,
      },
    ],
    "Value / insight": [
      {
        id: "hook_value_nobody_tells",
        family: "value_nobody_tells",
        value: `Here’s what almost nobody tells you about ${topic}.`,
      },
      {
        id: "hook_value_less_flashy",
        family: "value_less_flashy",
        value: `The real truth about ${topic} is less flashy than people think.`,
      },
      {
        id: "hook_value_changes_approach",
        family: "value_changes_approach",
        value: `This one insight about ${topic} changes how you approach it.`,
      },
      {
        id: "hook_value_better_question",
        family: "value_better_question",
        value: `The smartest people in ${topic} usually ask a different question first.`,
      },
      {
        id: "hook_value_hidden_leverage",
        family: "value_hidden_leverage",
        value: `There is more leverage in ${topic} than most people realize.`,
      },
      {
        id: "hook_value_clarity_shift",
        family: "value_clarity_shift",
        value: `If you want better results with ${topic}, this is the shift to understand.`,
      },
    ],
    "Authority framing": [
      {
        id: "hook_auth_fastest_understand",
        family: "auth_fastest_understand",
        value: `The people who grow fastest with ${topic} understand this first.`,
      },
      {
        id: "hook_auth_honest_take",
        family: "auth_honest_take",
        value: `My honest take on ${topic} is probably not what you expect.`,
      },
      {
        id: "hook_auth_start_here",
        family: "auth_start_here",
        value: `If you want real results with ${topic}, start here.`,
      },
      {
        id: "hook_auth_taken_seriously",
        family: "auth_taken_seriously",
        value: `If you want to be taken seriously in ${topic}, fix this first.`,
      },
      {
        id: "hook_auth_smartest_move",
        family: "auth_smartest_move",
        value: `The smartest move in ${topic} is usually not the loudest one.`,
      },
      {
        id: "hook_auth_signal_of_real_credibility",
        family: "auth_real_credibility",
        value: `Real credibility in ${topic} usually starts with this signal.`,
      },
    ],
    "Trust builder": [
      {
        id: "hook_trust_more_real",
        family: "trust_more_real",
        value: `Let’s make ${topic} feel a lot more real.`,
      },
      {
        id: "hook_trust_realistic_progress",
        family: "trust_realistic_progress",
        value: `This is what realistic progress with ${topic} actually looks like.`,
      },
      {
        id: "hook_trust_honest_version",
        family: "trust_honest_version",
        value: `If you want the honest version of ${topic}, here it is.`,
      },
      {
        id: "hook_trust_without_hype",
        family: "trust_without_hype",
        value: `You do not need more hype around ${topic}. You need this instead.`,
      },
      {
        id: "hook_trust_sounds_believable",
        family: "trust_sounds_believable",
        value: `This is how ${topic} starts sounding believable again.`,
      },
      {
        id: "hook_trust_people_can_feel_truth",
        family: "trust_people_feel_truth",
        value: `People can feel when ${topic} is being explained honestly.`,
      },
    ],
    "Warm CTA": [
      {
        id: "hook_warm_gets_real",
        family: "warm_gets_real",
        value: `If you’re serious about ${topic}, this is where it gets real.`,
      },
      {
        id: "hook_warm_not_enough",
        family: "warm_not_enough",
        value: `At some point, thinking about ${topic} isn’t enough anymore.`,
      },
      {
        id: "hook_warm_next_move",
        family: "warm_next_move",
        value: `If ${topic} matters to you, don’t ignore this next move.`,
      },
      {
        id: "hook_warm_context_ready",
        family: "warm_context_ready",
        value: `This is the stage where a smarter next step around ${topic} finally makes sense.`,
      },
      {
        id: "hook_warm_ready_to_move",
        family: "warm_ready_to_move",
        value: `If the earlier pieces clicked, ${topic} should feel different now.`,
      },
      {
        id: "hook_warm_bridge_to_action",
        family: "warm_bridge_to_action",
        value: `This is where clarity around ${topic} should start turning into movement.`,
      },
    ],
  };

  return map[args.dayRole] || [
    {
      id: "hook_generic_smart_angle",
      family: "generic_smart_angle",
      value: `Here’s a smarter angle on ${topic}.`,
    },
  ];
}

function bodyCandidates(args: BuildDayTextArgs): Variant[] {
  const topic = args.topic.trim();
  const platform = platformLabel(args.platform);
  const market = marketLabel(args.targetMarket);
  const offer = args.offerFocus?.trim();

  const map: Record<string, Variant[]> = {
    "Pattern interrupt": [
      {
        id: "body_pattern_shortcut",
        family: "body_pattern_shortcut",
        value: `A lot of people treat ${topic} like a shortcut. That is exactly why it stops working for them.\n\nThey start with the sale before they have built a reason to be trusted. On ${platform}, that usually kills momentum fast because the audience feels the pressure before it feels the value.\n\nFor a ${market} audience, the strongest early signal is usually relevance. If the post makes people stop and think, you already have more leverage than the average creator chasing quick clicks.`,
      },
      {
        id: "body_pattern_sound_advanced",
        family: "body_pattern_sound_advanced",
        value: `The biggest mistake in ${topic} is trying to look advanced before you have learned how to sound useful.\n\nPeople do not stay because you have a link. They stay because the post made them feel like you understand the problem better than most people do.\n\nThat is why simple, sharp content usually beats clever-but-empty content on ${platform}.`,
      },
      {
        id: "body_pattern_focus_on_action",
        family: "body_pattern_focus_on_action",
        value: `Most people go wrong with ${topic} because they focus on what they want the audience to do instead of what the audience needs to understand first.\n\nIf the post does not create clarity, trust or tension, the next step will always feel colder than it should.\n\nThat is why stopping the scroll matters more than sounding polished.`,
      },
      {
        id: "body_pattern_wrong_sequence",
        family: "body_pattern_wrong_sequence",
        value: `A weak sequence makes strong effort feel invisible in ${topic}.\n\nWhen creators push too early, the audience does not feel guided — it feels managed. On ${platform}, that lowers trust before momentum even has a chance to build.\n\nThe real win is not speed first. It is sequencing the message in a way the audience actually wants to keep following.`,
      },
      {
        id: "body_pattern_no_emotional_entry",
        family: "body_pattern_no_emotional_entry",
        value: `A lot of people lose momentum with ${topic} because their content never gives the audience a reason to care emotionally.\n\nIt might be correct, but it does not feel relevant enough to stop the scroll.\n\nFor a ${market} audience, that first emotional entry point matters more than people think because it decides whether the post gets ignored or remembered.`,
      },
      {
        id: "body_pattern_wrong_starting_point",
        family: "body_pattern_wrong_starting_point",
        value: `The starting point most people use in ${topic} is far too cold.\n\nThey open with the tool, the offer or the conclusion — instead of the tension that makes the audience want to stay.\n\nThat is why stronger content usually begins with recognition, not explanation.`,
      },
    ],

    "Value / insight": [
      {
        id: "body_value_clarity_beats_hype",
        family: "body_value_clarity_beats_hype",
        value: `The deeper truth about ${topic} is that clarity beats hype.\n\nThe people who grow fastest usually explain the problem better before they ever mention the solution. That is what makes the content feel stronger on ${platform} because people save what helps them think more clearly.\n\nFor an audience in ${market}, that kind of post feels useful instead of noisy — and useful content tends to travel further.`,
      },
      {
        id: "body_value_framing_changes_everything",
        family: "body_value_framing_changes_everything",
        value: `What most people miss about ${topic} is that better framing changes everything.\n\nA weak message can make a strong offer invisible, while a strong message can make a simple idea feel valuable.\n\nThat is why teaching one real thing well often outperforms trying to say ten things at once.`,
      },
      {
        id: "body_value_make_one_memorable",
        family: "body_value_make_one_memorable",
        value: `If you want better results in ${topic}, stop asking how to post more and start asking how to make one post more memorable.\n\nThe audience does not reward effort they cannot feel. They reward clarity, usefulness and emotional accuracy.\n\nThat is what makes value-based content more powerful than it looks.`,
      },
      {
        id: "body_value_smarter_question",
        family: "body_value_smarter_question",
        value: `The real edge in ${topic} is often not better execution. It is asking a better first question.\n\nOnce the message becomes more precise, the audience understands faster, saves more and trusts more.\n\nThat is why a sharper insight often beats another motivational post.`,
      },
      {
        id: "body_value_hidden_leverage",
        family: "body_value_hidden_leverage",
        value: `A lot of creators underestimate how much leverage there is in one strong insight around ${topic}.\n\nWhen a post changes how someone sees the problem, it earns more than attention — it earns memory.\n\nAnd memory is one of the strongest growth assets a creator can build on ${platform}.`,
      },
      {
        id: "body_value_precision_over_volume",
        family: "body_value_precision_over_volume",
        value: `More content does not fix weak insight.\n\nIf the point is shallow, the audience moves on. If the point is sharp, the same audience slows down, thinks and often saves the post.\n\nThat is why precision matters more than people think in ${topic}.`,
      },
    ],

    "Authority framing": [
      {
        id: "body_auth_taken_seriously",
        family: "body_auth_taken_seriously",
        value: `If you want to be taken seriously in ${topic}, stop trying to impress people and start helping them understand the real problem better than the average creator does.\n\nAuthority on ${platform} grows faster when the message feels grounded, clear and calmly confident.\n\nFor a ${market} audience, that kind of content feels worth following because it sounds like real understanding instead of borrowed certainty.`,
      },
      {
        id: "body_auth_obvious_truth",
        family: "body_auth_obvious_truth",
        value: `Real authority in ${topic} usually comes from one thing: saying the obvious truth that other people keep dancing around.\n\nThe creators who stand out are rarely the loudest. They are the ones who sound precise enough to trust.\n\nThat is why thoughtful posts often build more long-term momentum than louder ones.`,
      },
      {
        id: "body_auth_simple_without_shallow",
        family: "body_auth_simple_without_shallow",
        value: `The people who build real trust in ${topic} usually explain things in a way that feels simple without sounding shallow.\n\nThat balance is hard to fake, which is exactly why it works.\n\nWhen the audience feels smarter after reading you, authority starts building naturally.`,
      },
      {
        id: "body_auth_signal_of_credibility",
        family: "body_auth_signal_of_credibility",
        value: `Authority is usually built in smaller signals than most people expect.\n\nCalm precision, better framing and useful clarity often create more trust than stronger claims ever do.\n\nThat is why the best authority content feels steady, not desperate.`,
      },
      {
        id: "body_auth_useful_memory",
        family: "body_auth_useful_memory",
        value: `People follow authority when they believe the creator consistently improves how they think.\n\nThat means your content should not just sound correct. It should sound useful enough to remember.\n\nOn ${platform}, remembered content often beats louder content over time.`,
      },
      {
        id: "body_auth_confidence_without_noise",
        family: "body_auth_confidence_without_noise",
        value: `Confidence in ${topic} should feel clear, not theatrical.\n\nWhen the audience senses that the creator is trying too hard to prove status, trust often drops. When the message feels calm and exact, trust usually rises.\n\nThat is a more powerful authority signal than most people realize.`,
      },
    ],

    "Trust builder": [
      {
        id: "body_trust_need_real_explanation",
        family: "body_trust_need_real_explanation",
        value: `A lot of people do not need more motivation around ${topic}. They need someone who explains it without sounding fake.\n\nThat is why trust-building content matters so much on ${platform}. People are far more likely to stay with someone who feels honest than someone who feels optimized.\n\nFor an audience in ${market}, realism often builds more loyalty than polished perfection.`,
      },
      {
        id: "body_trust_experience_over_performance",
        family: "body_trust_experience_over_performance",
        value: `Trust grows when the content feels like it came from experience instead of performance.\n\nThat means less exaggeration, less pressure and more signals that the creator actually understands what this process feels like in real life.\n\nWhen people feel safe with your tone, they become far more open to the next thing you say.`,
      },
      {
        id: "body_trust_clear_calm_real",
        family: "body_trust_clear_calm_real",
        value: `The fastest way to lose people in ${topic} is to sound more certain than reality deserves.\n\nThe fastest way to keep them is to sound clear, calm and real.\n\nThat kind of energy is what makes trust compound instead of fading after one post.`,
      },
      {
        id: "body_trust_believable_not_perfect",
        family: "body_trust_believable_not_perfect",
        value: `People do not need your content to feel perfect. They need it to feel believable.\n\nWhen the audience feels that the creator is speaking from something real, resistance drops and retention often rises.\n\nThat is why authenticity is not just branding. It is conversion groundwork.`,
      },
      {
        id: "body_trust_safe_to_follow",
        family: "body_trust_safe_to_follow",
        value: `Trust-building content makes the audience feel safe to stay close a little longer.\n\nThat safety matters because most people do not move toward offers, ideas or creators that feel emotionally sharp too early.\n\nA strong trust day lowers that friction before it becomes a bigger problem.`,
      },
      {
        id: "body_trust_human_signal",
        family: "body_trust_human_signal",
        value: `A human signal is often more persuasive than a clever signal.\n\nThe creator who sounds real, useful and emotionally accurate usually builds stronger momentum than the one trying hardest to sound optimized.\n\nThat is why trust days deserve more respect in a serious push.`,
      },
    ],

    "Warm CTA": [
      {
        id: "body_warm_natural_step",
        family: "body_warm_natural_step",
        value: offer
          ? `At this stage, ${offer} should feel like a natural next step — not a random jump into promo mode.\n\nIf the earlier content has done its job, the audience already understands the problem, trusts your tone and feels some curiosity about the solution.\n\nThat is why the ask can stay calm here and still feel stronger.`
          : `At this stage, the next step should feel natural. If the content has done its job, action will not feel forced.\n\nThe audience should already have enough trust and enough context to move without needing a dramatic push.\n\nThat is what makes soft conversion feel stronger than hard pressure.`,
      },
      {
        id: "body_warm_context_built",
        family: "body_warm_context_built",
        value: offer
          ? `The reason ${offer} works better here is because context has already been built.\n\nWithout context, a CTA feels cold. With context, it feels helpful.\n\nThat difference is everything when you want clicks that actually come from intent.`
          : `This is the moment where trust quietly turns into action.\n\nNot because the CTA got louder — but because the audience got warmer.\n\nThat is how better content creates better movement.`,
      },
      {
        id: "body_warm_obvious_next_move",
        family: "body_warm_obvious_next_move",
        value: offer
          ? `If ${offer} is relevant, this is where it should start feeling obvious.\n\nThe audience does not need ten more reasons. It needs one clear next move that feels easy to trust.\n\nThat is what a good warm CTA is really doing.`
          : `A good CTA at this stage does not beg. It simply points.\n\nIf the earlier days were strong, the right people already feel ready.\n\nThat is why calm asks often outperform aggressive ones here.`,
      },
      {
        id: "body_warm_friction_lowered",
        family: "body_warm_friction_lowered",
        value: offer
          ? `By this point, ${offer} should no longer feel like an interruption.\n\nThe friction is lower because the audience has already been guided through the right emotional sequence.\n\nThat is what makes the next step warmer, not louder.`
          : `By this stage, the audience should not need another push of pressure.\n\nIt should need a smaller bridge, a calmer ask and a clear reason to move now instead of later.\n\nThat is what makes warm CTAs work.`,
      },
      {
        id: "body_warm_trust_to_movement",
        family: "body_warm_trust_to_movement",
        value: offer
          ? `The strongest move here is not over-explaining ${offer}. It is letting the earlier trust do part of the work.\n\nThat is why this kind of CTA performs best when it feels aligned with the sequence, not detached from it.\n\nA warm audience does not need noise. It needs direction.`
          : `A better CTA does not create trust from nothing. It builds on trust that already exists.\n\nThat is why this day matters so much: it is where direction begins to outperform persuasion.\n\nThe right people start moving because the sequence earned it.`,
      },
      {
        id: "body_warm_right_people_ready",
        family: "body_warm_right_people_ready",
        value: offer
          ? `The goal here is not to convince everyone about ${offer}.\n\nThe goal is to make the right people feel ready.\n\nWhen that happens, the click becomes warmer, the intent becomes cleaner and the whole push performs better downstream.`
          : `The strongest outcome here is not raw volume. It is cleaner intent.\n\nThat usually happens when the next step feels timely, relevant and emotionally lighter than earlier in the sequence.\n\nThat is exactly what this warm day is built to do.`,
      },
    ],
  };

  return map[args.dayRole] || [
    {
      id: "body_generic_progress",
      family: "generic_progress",
      value: `This day should move the audience one step forward around ${topic}.\n\nThe point is not to sound louder. The point is to sound clearer, more useful and more relevant than the average post.\n\nThat is what creates better momentum over time on ${platform} for a ${market} audience.`,
    },
  ];
}

function ctaCandidates(args: BuildDayTextArgs): Variant[] {
  const offer = args.offerFocus?.trim() || "this";

  const commentSet: Variant[] = [
    {
      id: "cta_comment_go_deeper",
      family: "cta_comment_go_deeper",
      value: "Comment if you want me to go deeper on this.",
    },
    {
      id: "cta_comment_part2",
      family: "cta_comment_part2",
      value: "Comment if you want part 2.",
    },
    {
      id: "cta_comment_if_hit",
      family: "cta_comment_if_hit",
      value: "Comment if this hit harder than expected.",
    },
    {
      id: "cta_comment_realistic_version",
      family: "cta_comment_realistic_version",
      value: "Comment if you want the realistic version of this topic.",
    },
  ];

  if (args.forceCommentCTA) {
    return commentSet;
  }

  const saveSet: Variant[] = [
    {
      id: "cta_save_later",
      family: "cta_save_later",
      value: "Save this and come back to it later.",
    },
    {
      id: "cta_save_breakdowns",
      family: "cta_save_breakdowns",
      value: "Save this if you want more breakdowns like this.",
    },
    {
      id: "cta_save_revisit",
      family: "cta_save_revisit",
      value: "Save this and revisit it later.",
    },
    {
      id: "cta_save_fake_advice",
      family: "cta_save_fake_advice",
      value: "Save this if you’re tired of fake advice.",
    },
  ];

  const followSet: Variant[] = [
    {
      id: "cta_follow_more_like_this",
      family: "cta_follow_more_like_this",
      value: "Follow for more like this.",
    },
    {
      id: "cta_follow_clear_takes",
      family: "cta_follow_clear_takes",
      value: "Follow for more clear takes like this.",
    },
    {
      id: "cta_follow_smarter_content",
      family: "cta_follow_smarter_content",
      value: "Follow if you want smarter content around this topic.",
    },
    {
      id: "cta_follow_if_helpful",
      family: "cta_follow_if_helpful",
      value: "Follow if you want more useful content like this.",
    },
  ];

  const warmSet: Variant[] = [
    {
      id: "cta_warm_next_step_relevant",
      family: "cta_warm_next_step_relevant",
      value: `If this is relevant for you, this is a good time to take the next step.`,
    },
    {
      id: "cta_warm_go_deeper_offer",
      family: "cta_warm_go_deeper_offer",
      value: `If you're ready, go deeper into ${offer}.`,
    },
    {
      id: "cta_warm_move_on_it",
      family: "cta_warm_move_on_it",
      value: `If this connects with where you are right now, move on it.`,
    },
    {
      id: "cta_warm_step_when_ready",
      family: "cta_warm_step_when_ready",
      value: `If this helped, the next step around ${offer} is there when you’re ready.`,
    },
  ];

  if (args.dayRole === "Warm CTA") {
    return warmSet;
  }

  if (args.ctaStyle === "direct") {
    return [
      {
        id: "cta_direct_step_today",
        family: "cta_direct_step_today",
        value: `If this is for you, take the next step on ${offer} today.`,
      },
      {
        id: "cta_direct_move_now",
        family: "cta_direct_move_now",
        value: `Ready to move? Go deeper into ${offer} now.`,
      },
      {
        id: "cta_direct_moment_to_act",
        family: "cta_direct_moment_to_act",
        value: `If you’ve been waiting, this is the moment to act on ${offer}.`,
      },
      ...commentSet,
    ];
  }

  if (args.ctaStyle === "medium") {
    return [...commentSet, ...saveSet, ...warmSet];
  }

  return [...commentSet, ...saveSet, ...followSet];
}

function replyCandidates(args: BuildDayTextArgs, cta: string): Variant[] {
  const topic = args.topic.trim();
  const offer = args.offerFocus?.trim();

  if (!/comment/i.test(cta)) return [];

  return [
    {
      id: "reply_go_deeper",
      family: "reply_go_deeper",
      value: `Love that — the biggest shift with ${topic} is usually simpler than people think. Want me to send part 2 here?`,
    },
    {
      id: "reply_break_next_step",
      family: "reply_break_next_step",
      value: `Good comment. A lot of people miss this exact point about ${topic}. I can break the next step down for you too.`,
    },
    {
      id: "reply_offer_bridge",
      family: "reply_offer_bridge",
      value: offer
        ? `Glad this resonated. ${offer} becomes much easier to understand once this first part clicks. Want the next breakdown?`
        : `Glad this landed. The next layer of ${topic} is where most people either build momentum or lose it. Want me to go deeper?`,
    },
    {
      id: "reply_yes_continue",
      family: "reply_yes_continue",
      value: `Absolutely — the next part of ${topic} is where it starts getting more practical. I can drop that here too.`,
    },
    {
      id: "reply_clarity_then_action",
      family: "reply_clarity_then_action",
      value: `Exactly. Once this part of ${topic} becomes clear, the next step feels much easier. Want me to keep going?`,
    },
  ];
}

function buildHashtags(args: BuildDayTextArgs) {
  const topicKey = args.topic.trim().toLowerCase();

  const topicMap: Record<string, string[]> = {
    "affiliate marketing": ["#affiliatemarketing", "#sidehustle", "#onlineincome"],
    "online income": ["#onlineincome", "#digitalincome", "#makemoneyonline"],
    "ai tools": ["#aitools", "#aiworkflow", "#aicontent"],
    "content growth": ["#contentgrowth", "#socialgrowth", "#creatorstrategy"],
    "digital products": ["#digitalproducts", "#onlinebusiness", "#creatorbusiness"],
    "recurring income": ["#recurringincome", "#monthlyincome", "#subscriptionbusiness"],
  };

  const marketMap: Record<PushTargetMarket, string[]> = {
    international_english: ["#englishcontent", "#globalcreators"],
    usa: ["#usacreators", "#usabusiness"],
    canada: ["#canadacreators", "#canadabusiness"],
    uk: ["#ukcreators", "#ukbusiness"],
    australia: ["#australiacreators", "#ausbusiness"],
    new_zealand: ["#nzcreators", "#newzealandbusiness"],
  };

  const pushMap: Record<PushType, string[]> = {
    authority: ["#authoritybuilding", "#trustcontent"],
    offer_warmup: ["#softselling", "#audiencewarming"],
    lead_magnet: ["#leadgeneration", "#leadmagnet"],
    recurring: ["#recurringrevenue", "#recurringincome"],
    mini_launch: ["#minilaunch", "#offerlaunch"],
    objection_breaker: ["#trustmarketing", "#buyerobjections"],
  };

  const goalMap: Record<PushGoal, string[]> = {
    engagement: ["#engagementtips"],
    followers: ["#growyouraudience"],
    warm_offer: ["#offerstrategy"],
    leads: ["#leadgrowth"],
    balanced_growth: ["#creatorgrowth"],
  };

  const topicTags = topicMap[topicKey] || [`#${topicKey.replace(/\s+/g, "")}`];
  const base = ["#contentstrategy", "#creatorbusiness"];

  return Array.from(
    new Set([
      ...topicTags,
      ...pushMap[args.pushType],
      ...goalMap[args.goal],
      ...marketMap[args.targetMarket],
      ...base,
    ])
  ).slice(0, 8);
}

function buildKeywordFocus(args: BuildDayTextArgs) {
  const items = [
    args.topic.trim(),
    args.pushType === "authority" ? "authority content" : "",
    args.goal === "engagement" ? "engagement growth" : "",
    args.goal === "followers" ? "follower growth" : "",
    args.goal === "leads" ? "lead generation" : "",
    args.goal === "warm_offer" ? "offer warm-up" : "",
    args.goal === "balanced_growth" ? "audience growth" : "",
    args.offerFocus?.trim() || "",
  ].filter(Boolean);

  return Array.from(new Set(items)).slice(0, 4);
}

function imagePromptCandidates(args: BuildDayTextArgs): Variant[] {
  const offer = args.offerFocus?.trim();
  const market = marketLabel(args.targetMarket);
  const platform = platformLabel(args.platform);

  return [
    {
      id: "image_high_contrast",
      family: "image_high_contrast",
      value: `Create a premium vertical social image for ${platform} about ${args.topic}. Audience: ${market}. Use a dark modern aesthetic, high contrast, clean focal point and strong readability. ${offer ? `Subtly support ${offer} without making it look like an ad.` : "Focus on trust, curiosity and relevance over direct promotion."}`,
    },
    {
      id: "image_editorial_dark",
      family: "image_editorial_dark",
      value: `Create a dark editorial-style vertical image for ${platform} around ${args.topic}. It should feel premium, intelligent and visually sharp for a ${market} audience. ${offer ? `Let ${offer} be a subtle supporting idea only.` : "Keep the image education-first, not sales-first."}`,
    },
    {
      id: "image_creator_authority",
      family: "image_creator_authority",
      value: `Create a premium creator-style image for ${platform} about ${args.topic}. Mood: confident, useful, trustworthy and modern. Use a dark luxury palette and a composition that feels worth stopping for.`,
    },
    {
      id: "image_trust_realistic",
      family: "image_trust_realistic",
      value: `Create a realistic premium vertical visual for ${platform} about ${args.topic}. It should feel believable, elegant and grounded rather than flashy, with strong visual clarity for a ${market} audience.`,
    },
    {
      id: "image_tension_curiosity",
      family: "image_tension_curiosity",
      value: `Create a high-end vertical image for ${platform} around ${args.topic} with subtle tension and curiosity. Make it look like a stop-scroll post that teaches something important, using dark premium tones.`,
    },
    {
      id: "image_clean_insight",
      family: "image_clean_insight",
      value: `Create a clean premium insight-based social image for ${platform} about ${args.topic}. Use elegant spacing, strong composition and a visual style that feels immediately useful and memorable.`,
    },
  ];
}

function videoScriptCandidates(args: BuildDayTextArgs): VariantArray[] {
  const offer = args.offerFocus?.trim();

  return [
    {
      id: "video_direct_breakdown",
      family: "video_direct_breakdown",
      value: [
        `Scene 1: Hook on screen in large text.`,
        `Scene 2: Creator explains the real issue around ${args.topic}.`,
        `Scene 3: Break down the mistake or misunderstanding clearly.`,
        `Scene 4: Show what stronger thinking or sequencing looks like.`,
        `Scene 5: End with the CTA from the post.`,
      ],
    },
    {
      id: "video_contrast_format",
      family: "video_contrast_format",
      value: [
        `Scene 1: Start with a strong hook and quick zoom-in.`,
        `Scene 2: Contrast what most people do in ${args.topic} with what actually works.`,
        `Scene 3: Give one insight the viewer can remember immediately.`,
        `Scene 4: Add one calm practical takeaway.`,
        `Scene 5: End with the CTA from the post.`,
      ],
    },
    {
      id: "video_truth_then_shift",
      family: "video_truth_then_shift",
      value: [
        `Scene 1: Put the hook on screen with premium dark background.`,
        `Scene 2: Creator says one honest truth about ${args.topic}.`,
        `Scene 3: Explain why most people miss it.`,
        `Scene 4: Show the shift in thinking that improves results.`,
        `Scene 5: End with the CTA from the post.`,
      ],
    },
    {
      id: "video_problem_solution",
      family: "video_problem_solution",
      value: [
        `Scene 1: Hook appears fast with subtle motion.`,
        `Scene 2: Creator names the real friction around ${args.topic}.`,
        `Scene 3: Show the consequence of ignoring that friction.`,
        `Scene 4: Present the cleaner solution or next move.`,
        `Scene 5: End with the CTA from the post.`,
      ],
    },
    {
      id: "video_comment_bait",
      family: "video_comment_bait",
      value: [
        `Scene 1: Use the hook as a bold text overlay.`,
        `Scene 2: Creator makes one strong but honest point about ${args.topic}.`,
        `Scene 3: Add a sentence that invites disagreement or reflection.`,
        `Scene 4: Reinforce the main takeaway in a calmer tone.`,
        `Scene 5: End with a CTA designed to pull comments.`,
      ],
    },
    {
      id: "video_save_bait",
      family: "video_save_bait",
      value: [
        `Scene 1: Hook appears in clean high-contrast text.`,
        `Scene 2: Creator shares one useful insight people will want to revisit.`,
        `Scene 3: Break the insight into one memorable takeaway.`,
        `Scene 4: Frame it as something worth saving for later.`,
        `Scene 5: End with the CTA from the post.`,
      ],
    },
  ];
}

function buildOptimizingFor(args: BuildDayTextArgs): DayOptimizationFocus[] {
  if (args.goal === "engagement") return ["comments", "saves", "reach"];
  if (args.goal === "followers") return ["follows", "reach", "trust"];
  if (args.goal === "leads") return ["warm_clicks", "leads", "trust"];
  if (args.goal === "warm_offer") return ["trust", "warm_clicks", "comments"];
  return ["reach", "trust", "comments"];
}

export function createUniquenessContext(): PushUniquenessContext {
  return {
    usedHooks: new Set<string>(),
    usedHookFamilies: new Set<string>(),
    usedBodies: new Set<string>(),
    usedBodyFamilies: new Set<string>(),
    usedCTAs: new Set<string>(),
    usedCTAFamilies: new Set<string>(),
    usedReplies: new Set<string>(),
    usedReplyFamilies: new Set<string>(),
    usedImagePrompts: new Set<string>(),
    usedImagePromptFamilies: new Set<string>(),
    usedVideoScripts: new Set<string>(),
    usedVideoScriptFamilies: new Set<string>(),
  };
}

export function buildPushDayText(
  args: BuildDayTextArgs,
  uniqueness?: PushUniquenessContext
): BuiltDayContent {
  const ctx = uniqueness || createUniquenessContext();

  const hook = pickVariant(
    hookCandidates(args),
    ctx.usedHooks,
    ctx.usedHookFamilies
  );

  const body = pickVariant(
    bodyCandidates(args),
    ctx.usedBodies,
    ctx.usedBodyFamilies
  );

  const cta = pickVariant(
    ctaCandidates(args),
    ctx.usedCTAs,
    ctx.usedCTAFamilies
  );

  const replyPool = replyCandidates(args, cta.value);
  const reply =
    replyPool.length > 0
      ? pickVariant(replyPool, ctx.usedReplies, ctx.usedReplyFamilies)
      : null;

  const imagePrompt = pickVariant(
    imagePromptCandidates(args),
    ctx.usedImagePrompts,
    ctx.usedImagePromptFamilies
  );

  const videoScript = pickVariantArray(
    videoScriptCandidates(args),
    ctx.usedVideoScripts,
    ctx.usedVideoScriptFamilies
  );

  return {
    hook: hook.value,
    hookFamily: hook.family,
    body: body.value,
    bodyFamily: body.family,
    cta: cta.value,
    ctaFamily: cta.family,
    commentReply: reply?.value ?? null,
    commentReplyFamily: reply?.family ?? null,
    hashtags: buildHashtags(args),
    keywordFocus: buildKeywordFocus(args),
    imagePrompt: imagePrompt.value,
    imagePromptFamily: imagePrompt.family,
    videoScript: videoScript.value,
    videoScriptFamily: videoScript.family,
    optimizingFor: buildOptimizingFor(args),
  };
}

export function buildPushTitle(pushType: PushType, topic: string) {
  const cleanTopic = titleCase(topic.trim() || "Your Topic");

  switch (pushType) {
    case "authority":
      return `${cleanTopic} Authority Push`;
    case "offer_warmup":
      return `${cleanTopic} Offer Warm-Up Push`;
    case "lead_magnet":
      return `${cleanTopic} Lead Magnet Push`;
    case "recurring":
      return `${cleanTopic} Recurring Push`;
    case "mini_launch":
      return `${cleanTopic} Mini Launch Push`;
    case "objection_breaker":
      return `${cleanTopic} Objection Breaker Push`;
    default:
      return `${cleanTopic} Autoaffi Push`;
  }
}

export function buildWhyThisPushWorks(args: {
  pushType: PushType;
  goal: PushGoal;
  topic: string;
  offerFocus?: string;
}) {
  const { pushType, topic, offerFocus } = args;

  if (pushType === "authority") {
    return `This push is designed to build trust, credibility and follower growth around ${topic} before asking for too much too soon.`;
  }

  if (pushType === "offer_warmup") {
    return `This push gradually warms people up around ${topic}${offerFocus ? ` and ${offerFocus}` : ""}, making clicks and conversion feel more natural later.`;
  }

  if (pushType === "lead_magnet") {
    return `This push is built to create relevance and intent first, so more people are ready to opt in when the lead magnet appears.`;
  }

  if (pushType === "recurring") {
    return `This push helps position recurring income as attractive, stable and realistic — which makes the offer feel more valuable over time.`;
  }

  if (pushType === "mini_launch") {
    return `This push creates short-term momentum through teaser, reveal and conversion structure without sounding flat or repetitive.`;
  }

  return `This push is designed to reduce hesitation and help warmer audiences feel safer taking the next step around ${topic}.`;
}

export function buildAlgorithmNoteOverride(args: {
  pushType: PushType;
  goal: PushGoal;
  dayNumber: number;
}) {
  const { pushType, goal, dayNumber } = args;

  if (goal === "followers" && dayNumber <= 4) {
    return "Built for follows, comments and profile interest.";
  }

  if (goal === "engagement" && dayNumber <= 4) {
    return "Built for comments, saves and stronger distribution signals.";
  }

  if (goal === "leads" && dayNumber >= 4) {
    return "Built for warmer clicks and stronger lead intent.";
  }

  if (pushType === "mini_launch" && dayNumber >= 6) {
    return "Built for urgency, clicks and action.";
  }

  return null;
}