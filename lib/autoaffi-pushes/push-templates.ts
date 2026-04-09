import type { PushType } from "@/app/login/dashboard/autoaffi-pushes/types";

export type PushDayTemplate = {
  dayNumber: number;
  dayTitle: string;
  dayRole: string;
  whyThisDayMatters: string;
  algorithmNote: string;
};

type PushTemplateMap = Record<PushType, { days5: PushDayTemplate[]; days7: PushDayTemplate[] }>;

export const PUSH_TEMPLATES: PushTemplateMap = {
  authority: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "Common mistake",
        dayRole: "Pattern interrupt",
        whyThisDayMatters:
          "Day 1 is built to stop the scroll and create immediate relevance.",
        algorithmNote: "Built for curiosity and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "Deeper insight",
        dayRole: "Value / insight",
        whyThisDayMatters:
          "Day 2 deepens trust by showing the audience you understand the real problem.",
        algorithmNote: "Built for saves and watch time.",
      },
      {
        dayNumber: 3,
        dayTitle: "Your perspective",
        dayRole: "Authority framing",
        whyThisDayMatters:
          "Day 3 gives the audience a reason to see you as a trusted voice worth following.",
        algorithmNote: "Built for follows and profile clicks.",
      },
      {
        dayNumber: 4,
        dayTitle: "Proof or realism",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 4 reduces skepticism by grounding the message in proof, realism or experience.",
        algorithmNote: "Built for trust and meaningful engagement.",
      },
      {
        dayNumber: 5,
        dayTitle: "Soft invitation",
        dayRole: "Warm CTA",
        whyThisDayMatters:
          "Day 5 invites action naturally after trust and interest have already been built.",
        algorithmNote: "Built for soft clicks and warmer intent.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "Common mistake",
        dayRole: "Pattern interrupt",
        whyThisDayMatters:
          "Day 1 is built to stop the scroll and create immediate relevance.",
        algorithmNote: "Built for curiosity and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "False belief",
        dayRole: "Myth breaker",
        whyThisDayMatters:
          "Day 2 challenges an assumption that keeps people stuck.",
        algorithmNote: "Built for debate and comments.",
      },
      {
        dayNumber: 3,
        dayTitle: "Deeper insight",
        dayRole: "Value / insight",
        whyThisDayMatters:
          "Day 3 adds real value so the audience sees you as worth listening to.",
        algorithmNote: "Built for saves and shares.",
      },
      {
        dayNumber: 4,
        dayTitle: "Your perspective",
        dayRole: "Authority framing",
        whyThisDayMatters:
          "Day 4 makes your point of view more memorable and distinct.",
        algorithmNote: "Built for follows and identity-based engagement.",
      },
      {
        dayNumber: 5,
        dayTitle: "Proof or realism",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 5 adds realism so your content feels grounded rather than hype-driven.",
        algorithmNote: "Built for trust and profile clicks.",
      },
      {
        dayNumber: 6,
        dayTitle: "Objection handling",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 addresses the hesitation that stops people from taking the next step.",
        algorithmNote: "Built for comments and warmer intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "Soft invitation",
        dayRole: "Warm CTA",
        whyThisDayMatters:
          "Day 7 invites action only after enough trust and familiarity has been created.",
        algorithmNote: "Built for soft clicks and conversions.",
      },
    ],
  },

  offer_warmup: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "Pain / frustration",
        dayRole: "Problem awareness",
        whyThisDayMatters:
          "Day 1 helps the audience feel seen and understood before any solution is introduced.",
        algorithmNote: "Built for relevance and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "Why most fail",
        dayRole: "Mistake exposure",
        whyThisDayMatters:
          "Day 2 builds tension by showing why people stay stuck.",
        algorithmNote: "Built for saves and discussion.",
      },
      {
        dayNumber: 3,
        dayTitle: "A better way",
        dayRole: "Solution framing",
        whyThisDayMatters:
          "Day 3 introduces a better direction without hard selling.",
        algorithmNote: "Built for curiosity and profile clicks.",
      },
      {
        dayNumber: 4,
        dayTitle: "Proof / example",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 4 makes the solution feel more believable and concrete.",
        algorithmNote: "Built for trust and comments.",
      },
      {
        dayNumber: 5,
        dayTitle: "Soft CTA",
        dayRole: "Warm conversion",
        whyThisDayMatters:
          "Day 5 gives the audience a natural next step after being warmed up properly.",
        algorithmNote: "Built for soft clicks and warmer leads.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "Pain / frustration",
        dayRole: "Problem awareness",
        whyThisDayMatters:
          "Day 1 creates emotional relevance and pulls the right audience in.",
        algorithmNote: "Built for attention and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "Hidden cost",
        dayRole: "Consequence framing",
        whyThisDayMatters:
          "Day 2 shows the cost of staying stuck, which increases intent.",
        algorithmNote: "Built for saves and reflection.",
      },
      {
        dayNumber: 3,
        dayTitle: "Why most fail",
        dayRole: "Mistake exposure",
        whyThisDayMatters:
          "Day 3 surfaces the common mistake blocking results.",
        algorithmNote: "Built for discussion and shareability.",
      },
      {
        dayNumber: 4,
        dayTitle: "A better way",
        dayRole: "Solution framing",
        whyThisDayMatters:
          "Day 4 turns attention into interest by showing a different path.",
        algorithmNote: "Built for curiosity and profile clicks.",
      },
      {
        dayNumber: 5,
        dayTitle: "Proof / example",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 5 adds proof so the audience starts believing the solution is real.",
        algorithmNote: "Built for trust and meaningful engagement.",
      },
      {
        dayNumber: 6,
        dayTitle: "Objection handling",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 handles hesitation before the ask is made.",
        algorithmNote: "Built for comments and warmer intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "Soft CTA",
        dayRole: "Warm conversion",
        whyThisDayMatters:
          "Day 7 gives a clear next step only after proper warming.",
        algorithmNote: "Built for soft clicks and conversions.",
      },
    ],
  },

  lead_magnet: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "Pain awareness",
        dayRole: "Relevance builder",
        whyThisDayMatters:
          "Day 1 makes the lead magnet feel relevant to a real problem.",
        algorithmNote: "Built for comments and relatability.",
      },
      {
        dayNumber: 2,
        dayTitle: "Common obstacle",
        dayRole: "Problem deepener",
        whyThisDayMatters:
          "Day 2 strengthens intent by making the pain more specific.",
        algorithmNote: "Built for saves and shares.",
      },
      {
        dayNumber: 3,
        dayTitle: "Quick value",
        dayRole: "Trust / value",
        whyThisDayMatters:
          "Day 3 proves that you have something genuinely helpful to offer.",
        algorithmNote: "Built for trust and saves.",
      },
      {
        dayNumber: 4,
        dayTitle: "I made this for you",
        dayRole: "Lead magnet bridge",
        whyThisDayMatters:
          "Day 4 introduces the lead magnet naturally as a useful next step.",
        algorithmNote: "Built for curiosity and profile clicks.",
      },
      {
        dayNumber: 5,
        dayTitle: "CTA to opt-in",
        dayRole: "Lead capture",
        whyThisDayMatters:
          "Day 5 converts warm interest into opt-ins without sounding pushy.",
        algorithmNote: "Built for leads and warmer clicks.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "Pain awareness",
        dayRole: "Relevance builder",
        whyThisDayMatters:
          "Day 1 attracts the right audience by speaking directly to a real pain.",
        algorithmNote: "Built for comments and attention.",
      },
      {
        dayNumber: 2,
        dayTitle: "Common obstacle",
        dayRole: "Problem deepener",
        whyThisDayMatters:
          "Day 2 makes the problem more specific and memorable.",
        algorithmNote: "Built for saves and reflection.",
      },
      {
        dayNumber: 3,
        dayTitle: "Myth / wrong approach",
        dayRole: "Mistake exposure",
        whyThisDayMatters:
          "Day 3 clears out bad assumptions before you offer a better next step.",
        algorithmNote: "Built for engagement and discussion.",
      },
      {
        dayNumber: 4,
        dayTitle: "Quick value",
        dayRole: "Trust / value",
        whyThisDayMatters:
          "Day 4 proves usefulness before the lead magnet enters the picture.",
        algorithmNote: "Built for saves and trust.",
      },
      {
        dayNumber: 5,
        dayTitle: "I made this for you",
        dayRole: "Lead magnet bridge",
        whyThisDayMatters:
          "Day 5 makes the lead magnet feel helpful rather than promotional.",
        algorithmNote: "Built for curiosity and clicks.",
      },
      {
        dayNumber: 6,
        dayTitle: "Objection handling",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 handles hesitation about opting in.",
        algorithmNote: "Built for comments and warmer intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "CTA to opt-in",
        dayRole: "Lead capture",
        whyThisDayMatters:
          "Day 7 converts warmed-up attention into actual leads.",
        algorithmNote: "Built for leads and conversions.",
      },
    ],
  },

  recurring: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "One-time vs recurring",
        dayRole: "Perspective shift",
        whyThisDayMatters:
          "Day 1 reframes how the audience thinks about income and stability.",
        algorithmNote: "Built for comments and curiosity.",
      },
      {
        dayNumber: 2,
        dayTitle: "Why recurring matters",
        dayRole: "Value framing",
        whyThisDayMatters:
          "Day 2 builds desire around predictability and long-term income.",
        algorithmNote: "Built for saves and shares.",
      },
      {
        dayNumber: 3,
        dayTitle: "Simple scenario",
        dayRole: "Mental picture",
        whyThisDayMatters:
          "Day 3 makes recurring income feel concrete and easy to imagine.",
        algorithmNote: "Built for curiosity and trust.",
      },
      {
        dayNumber: 4,
        dayTitle: "Proof / setup angle",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 4 grounds the concept in something believable and practical.",
        algorithmNote: "Built for trust and profile clicks.",
      },
      {
        dayNumber: 5,
        dayTitle: "Soft recurring CTA",
        dayRole: "Warm conversion",
        whyThisDayMatters:
          "Day 5 offers a next step after the concept has been made attractive first.",
        algorithmNote: "Built for soft clicks and warmer conversions.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "One-time vs recurring",
        dayRole: "Perspective shift",
        whyThisDayMatters:
          "Day 1 gets the audience to question their current model.",
        algorithmNote: "Built for comments and curiosity.",
      },
      {
        dayNumber: 2,
        dayTitle: "The hidden downside",
        dayRole: "Pain exposure",
        whyThisDayMatters:
          "Day 2 shows why unstable income creates stress and inconsistency.",
        algorithmNote: "Built for relevance and discussion.",
      },
      {
        dayNumber: 3,
        dayTitle: "Why recurring matters",
        dayRole: "Value framing",
        whyThisDayMatters:
          "Day 3 sells the idea before it sells the offer.",
        algorithmNote: "Built for saves and shares.",
      },
      {
        dayNumber: 4,
        dayTitle: "Simple scenario",
        dayRole: "Mental picture",
        whyThisDayMatters:
          "Day 4 helps the audience picture how recurring changes the game.",
        algorithmNote: "Built for curiosity and follows.",
      },
      {
        dayNumber: 5,
        dayTitle: "Proof / setup angle",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 5 makes the model feel practical, not theoretical.",
        algorithmNote: "Built for trust and profile clicks.",
      },
      {
        dayNumber: 6,
        dayTitle: "Objection handling",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 reduces fear and skepticism before the ask.",
        algorithmNote: "Built for comments and intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "Soft recurring CTA",
        dayRole: "Warm conversion",
        whyThisDayMatters:
          "Day 7 gives a next step only after enough trust has been built.",
        algorithmNote: "Built for soft clicks and conversions.",
      },
    ],
  },

  mini_launch: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "Teaser",
        dayRole: "Attention builder",
        whyThisDayMatters:
          "Day 1 starts momentum by teasing something worth watching.",
        algorithmNote: "Built for curiosity and profile visits.",
      },
      {
        dayNumber: 2,
        dayTitle: "Problem build-up",
        dayRole: "Pain amplifier",
        whyThisDayMatters:
          "Day 2 increases tension and relevance before the reveal.",
        algorithmNote: "Built for comments and watch time.",
      },
      {
        dayNumber: 3,
        dayTitle: "Reveal",
        dayRole: "Offer introduction",
        whyThisDayMatters:
          "Day 3 reveals the thing being launched in a focused way.",
        algorithmNote: "Built for curiosity and clicks.",
      },
      {
        dayNumber: 4,
        dayTitle: "Why it matters",
        dayRole: "Value framing",
        whyThisDayMatters:
          "Day 4 helps the audience understand why they should care.",
        algorithmNote: "Built for saves and trust.",
      },
      {
        dayNumber: 5,
        dayTitle: "CTA push",
        dayRole: "Conversion day",
        whyThisDayMatters:
          "Day 5 is the clearest ask, after enough momentum has been built.",
        algorithmNote: "Built for clicks, leads or sales.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "Teaser",
        dayRole: "Attention builder",
        whyThisDayMatters:
          "Day 1 sparks attention without giving everything away.",
        algorithmNote: "Built for curiosity and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "Problem build-up",
        dayRole: "Pain amplifier",
        whyThisDayMatters:
          "Day 2 makes the launch feel relevant to a real frustration.",
        algorithmNote: "Built for comments and saves.",
      },
      {
        dayNumber: 3,
        dayTitle: "More anticipation",
        dayRole: "Momentum builder",
        whyThisDayMatters:
          "Day 3 keeps interest high and prevents the push from dying early.",
        algorithmNote: "Built for repeat engagement.",
      },
      {
        dayNumber: 4,
        dayTitle: "Reveal",
        dayRole: "Offer introduction",
        whyThisDayMatters:
          "Day 4 is the reveal point that turns attention into active interest.",
        algorithmNote: "Built for curiosity and profile clicks.",
      },
      {
        dayNumber: 5,
        dayTitle: "Why it matters",
        dayRole: "Value framing",
        whyThisDayMatters:
          "Day 5 explains the value so the reveal does not feel empty.",
        algorithmNote: "Built for trust and saves.",
      },
      {
        dayNumber: 6,
        dayTitle: "Objections / FAQ",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 removes hesitation before the main ask.",
        algorithmNote: "Built for comments and warmer intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "CTA push",
        dayRole: "Conversion day",
        whyThisDayMatters:
          "Day 7 is the strongest ask after enough setup has happened.",
        algorithmNote: "Built for clicks, leads or sales.",
      },
    ],
  },

  objection_breaker: {
    days5: [
      {
        dayNumber: 1,
        dayTitle: "I used to think this too",
        dayRole: "Empathy opener",
        whyThisDayMatters:
          "Day 1 lowers resistance by showing you understand their hesitation.",
        algorithmNote: "Built for trust and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "The common objection",
        dayRole: "Objection spotlight",
        whyThisDayMatters:
          "Day 2 names the fear out loud instead of pretending it does not exist.",
        algorithmNote: "Built for discussion and saves.",
      },
      {
        dayNumber: 3,
        dayTitle: "What’s actually true",
        dayRole: "Reframe",
        whyThisDayMatters:
          "Day 3 replaces fear with a more grounded perspective.",
        algorithmNote: "Built for trust and curiosity.",
      },
      {
        dayNumber: 4,
        dayTitle: "Proof / realism",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 4 gives the audience a reason to believe the reframe.",
        algorithmNote: "Built for trust and profile clicks.",
      },
      {
        dayNumber: 5,
        dayTitle: "Soft CTA",
        dayRole: "Warm action",
        whyThisDayMatters:
          "Day 5 invites action after emotional resistance has been lowered.",
        algorithmNote: "Built for warmer clicks and leads.",
      },
    ],
    days7: [
      {
        dayNumber: 1,
        dayTitle: "I used to think this too",
        dayRole: "Empathy opener",
        whyThisDayMatters:
          "Day 1 makes the audience feel understood instead of judged.",
        algorithmNote: "Built for trust and comments.",
      },
      {
        dayNumber: 2,
        dayTitle: "The common objection",
        dayRole: "Objection spotlight",
        whyThisDayMatters:
          "Day 2 surfaces the hidden resistance directly.",
        algorithmNote: "Built for discussion and saves.",
      },
      {
        dayNumber: 3,
        dayTitle: "Why people stay stuck",
        dayRole: "Pain exposure",
        whyThisDayMatters:
          "Day 3 shows the cost of staying trapped in that objection.",
        algorithmNote: "Built for reflection and engagement.",
      },
      {
        dayNumber: 4,
        dayTitle: "What’s actually true",
        dayRole: "Reframe",
        whyThisDayMatters:
          "Day 4 introduces the healthier and more useful perspective.",
        algorithmNote: "Built for trust and curiosity.",
      },
      {
        dayNumber: 5,
        dayTitle: "Proof / realism",
        dayRole: "Trust builder",
        whyThisDayMatters:
          "Day 5 supports the reframe with realism and credibility.",
        algorithmNote: "Built for trust and profile clicks.",
      },
      {
        dayNumber: 6,
        dayTitle: "Last hesitation",
        dayRole: "Resistance reducer",
        whyThisDayMatters:
          "Day 6 clears the final emotional obstacle before the CTA.",
        algorithmNote: "Built for comments and warmer intent.",
      },
      {
        dayNumber: 7,
        dayTitle: "Soft CTA",
        dayRole: "Warm action",
        whyThisDayMatters:
          "Day 7 gives a clear next step when resistance is already lower.",
        algorithmNote: "Built for softer conversions.",
      },
    ],
  },
};

export function getPushTemplate(pushType: PushType, durationDays: 5 | 7): PushDayTemplate[] {
  const config = PUSH_TEMPLATES[pushType];
  return durationDays === 7 ? config.days7 : config.days5;
}