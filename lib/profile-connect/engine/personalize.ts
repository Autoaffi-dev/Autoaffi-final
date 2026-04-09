import type { BrandProfile } from "./types";

/**
 * This file makes Profile & Connect feel unique per customer.
 * It does NOT rely only on raw {niche}/{audience}/{outcome}.
 * It also rotates phrasing by tone + seed so users don't get near-identical copy.
 */

type ToneKey = "friendly" | "direct" | "premium";

type PhraseBank = {
  helpingVerbs: string[];
  resultPhrases: string[];
  clarityPhrases: string[];
  ctaOpeners: string[];
};

const BANKS: Record<ToneKey, PhraseBank> = {
  friendly: {
    helpingVerbs: [
      "Helping",
      "Guiding",
      "Showing",
      "Supporting",
      "Teaching",
    ],
    resultPhrases: [
      "get started with",
      "build momentum in",
      "make progress with",
      "improve results in",
      "grow with",
    ],
    clarityPhrases: [
      "simple steps",
      "clear structure",
      "easy-to-follow system",
      "beginner-friendly plan",
      "practical next steps",
    ],
    ctaOpeners: [
      "Get the free plan",
      "Start with the free setup",
      "Use the free starter plan",
      "Grab the free plan",
      "Start here with the free plan",
    ],
  },

  direct: {
    helpingVerbs: [
      "Helping",
      "Building",
      "Creating",
      "Driving",
      "Turning",
    ],
    resultPhrases: [
      "get better results with",
      "turn attention into",
      "convert traffic into",
      "build a system for",
      "create consistent",
    ],
    clarityPhrases: [
      "clear system",
      "conversion-focused process",
      "repeatable workflow",
      "structured setup",
      "measurable next steps",
    ],
    ctaOpeners: [
      "Get the plan",
      "Use the setup link",
      "Start with the system",
      "Access the plan",
      "Get the tracked setup",
    ],
  },

  premium: {
    helpingVerbs: [
      "Helping",
      "Positioning",
      "Equipping",
      "Enabling",
      "Guiding",
    ],
    resultPhrases: [
      "build a stronger",
      "create a higher-converting",
      "develop a cleaner",
      "improve the quality of",
      "strengthen",
    ],
    clarityPhrases: [
      "refined system",
      "high-trust structure",
      "clean conversion flow",
      "premium setup",
      "strategic foundation",
    ],
    ctaOpeners: [
      "Access the plan",
      "Get the full setup",
      "Start with the strategic plan",
      "Use the guided setup",
      "Unlock the full framework",
    ],
  },
};

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

function compact(value?: string | null, fallback = ""): string {
  return (value || fallback).trim();
}

export function buildPersonalizedVariables(params: {
  brand?: BrandProfile;
  seed: number;
}) {
  const tone = (params.brand?.tone || "friendly") as ToneKey;
  const bank = BANKS[tone] || BANKS.friendly;
  const seed = params.seed;

  const niche = compact(params.brand?.niche, "your niche");
  const audience = compact(params.brand?.audience, "beginners");
  const outcome = compact(params.brand?.outcome, "better results");

  const helpingVerb = pick(bank.helpingVerbs, seed, 0);
  const resultPhrase = pick(bank.resultPhrases, seed, 1);
  const clarityPhrase = pick(bank.clarityPhrases, seed, 2);
  const ctaOpener = pick(bank.ctaOpeners, seed, 3);

  return {
    niche,
    audience,
    outcome,
    helpingVerb,
    resultPhrase,
    clarityPhrase,
    ctaOpener,
  };
}

/**
 * Supported tokens:
 * {niche}
 * {audience}
 * {outcome}
 * {helpingVerb}
 * {resultPhrase}
 * {clarityPhrase}
 * {ctaOpener}
 */
export function personalizeTemplate(params: {
  input: string;
  brand?: BrandProfile;
  seed: number;
}): string {
  const vars = buildPersonalizedVariables({
    brand: params.brand,
    seed: params.seed,
  });

  return params.input
    .replaceAll("{niche}", vars.niche)
    .replaceAll("{audience}", vars.audience)
    .replaceAll("{outcome}", vars.outcome)
    .replaceAll("{helpingVerb}", vars.helpingVerb)
    .replaceAll("{resultPhrase}", vars.resultPhrase)
    .replaceAll("{clarityPhrase}", vars.clarityPhrase)
    .replaceAll("{ctaOpener}", vars.ctaOpener);
}
