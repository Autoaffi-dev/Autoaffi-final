import type {
  PlatformKey,
  StepKey,
  StepPayload,
  VariantTemplate,
  RotationMode,
  BrandProfile,
} from "./types";

type GenerateStepPayloadInput = {
  platform: PlatformKey;
  step: StepKey;
  variants: VariantTemplate[];
  rotationMode?: RotationMode;
  sessionId?: string;
  brandProfile?: BrandProfile;
};

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickVariant(
  variants: VariantTemplate[],
  rotationMode: RotationMode,
  sessionId?: string
) {
  if (!variants.length) {
    throw new Error("No variants available for generator.");
  }

  if (rotationMode === "session") {
    const seed = sessionId || "default";
    const index = hashString(seed) % variants.length;
    return variants[index];
  }

  const today = new Date().toISOString().slice(0, 10);
  const index = hashString(today) % variants.length;
  return variants[index];
}

function applyBrandProfileText(text: string, brandProfile?: BrandProfile) {
  if (!text) return text;

  let output = text;

  if (brandProfile?.audience) {
    output = output.replace(/\[AUDIENCE\]/g, brandProfile.audience);
  }

  if (brandProfile?.outcome) {
    output = output.replace(/\[OUTCOME\]/g, brandProfile.outcome);
  }

  if (brandProfile?.niche) {
    output = output.replace(/\[NICHE\]/g, brandProfile.niche);
  }

  return output;
}

export function generateStepPayload({
  platform,
  step,
  variants,
  rotationMode = "session",
  sessionId,
  brandProfile,
}: GenerateStepPayloadInput): StepPayload {
  const chosen = pickVariant(variants, rotationMode, sessionId);

  return {
    id: chosen.id,
    step,
    platform,
    variant_id: chosen.id,
    rotation_key: `${platform}_${step}_${rotationMode}_${sessionId || "default"}`,
    title: applyBrandProfileText(chosen.title, brandProfile),
    subtitle: chosen.subtitle
      ? applyBrandProfileText(chosen.subtitle, brandProfile)
      : undefined,
    instructions: (chosen.instructions || []).map((item) =>
      applyBrandProfileText(item, brandProfile)
    ),
    examples: chosen.examples || [],
    copy_blocks: chosen.copy_blocks?.map((block) => ({
      ...block,
      text: applyBrandProfileText(block.text, brandProfile),
      helper: block.helper
        ? applyBrandProfileText(block.helper, brandProfile)
        : undefined,
    })),
    checklists: chosen.checklists || [],
    completion_requirements: (chosen.completion_requirements || []).map((item) =>
      applyBrandProfileText(item, brandProfile)
    ),
  };
}
