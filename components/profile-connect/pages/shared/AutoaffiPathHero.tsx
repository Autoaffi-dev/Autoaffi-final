"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  showSecondaryCta?: boolean;

  badgeText?: string;
  supportTitle?: string;
  supportText?: string;

  point1Title?: string;
  point1Text?: string;
  point2Title?: string;
  point2Text?: string;
  point3Title?: string;
  point3Text?: string;

  videoTitle?: string;
  videoSubtitle?: string;
  hasVideoGuide?: boolean;

  variantSeed?: string;
};

const DEFAULT_TITLE = "A clearer path with a more useful first step";

const DEFAULT_SUBTITLE =
  "This page is designed to make the next move feel simpler, clearer and easier to trust from the very first click.";

/**
 * IMPORTANT:
 * Use only real beast base images that actually exist right now.
 */
const BEAST_BASES = [
  "/images/profile-connect/beast/autoaffi-story-beast-01.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-02.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-03.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-04.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-05.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-06.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-07.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-08.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-09.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-10.jpg",
  "/images/profile-connect/beast/autoaffi-story-beast-11.jpg",
] as const;

const DEFAULT_FALLBACK_IMAGE =
  "/images/profile-connect/beast/autoaffi-story-beast-01.jpg";

const OVERLAY_CLASSES = [
  "from-yellow-400/12 via-transparent to-sky-400/10",
  "from-amber-300/14 via-transparent to-cyan-400/8",
  "from-yellow-500/10 via-transparent to-indigo-400/10",
  "from-orange-300/12 via-transparent to-blue-400/10",
] as const;

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickBySeed<T>(items: readonly T[], seed: string, fallback: T): T {
  if (!items.length) return fallback;
  const index = hashString(seed || "autoaffi-default") % items.length;
  return items[index] ?? fallback;
}

function seededNumber(seed: string, salt: string, min: number, max: number) {
  const h = hashString(`${seed}:${salt}`);
  const normalized = (h % 10000) / 10000;
  return min + (max - min) * normalized;
}

function normalizeImageUrl(url?: string) {
  return (url || "").trim();
}

function resolveBaseImage(imageUrl?: string, variantSeed?: string) {
  const explicit = normalizeImageUrl(imageUrl);
  if (explicit) return explicit;

  return pickBySeed(
    BEAST_BASES,
    `${variantSeed || "autoaffi-default"}-base`,
    DEFAULT_FALLBACK_IMAGE
  );
}

export default function AutoaffiPathHero({
  eyebrow = "AUTOAFFI PATH",
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  imageUrl,
  imageAlt = "Autoaffi premium path visual",
  primaryCtaLabel = "Continue",
  secondaryCtaLabel = "Learn More",
  onPrimaryClick,
  onSecondaryClick,
  showSecondaryCta = true,
  variantSeed = "autoaffi-default",
}: Props) {
  const resolvedImage = useMemo(
    () => resolveBaseImage(imageUrl, variantSeed),
    [imageUrl, variantSeed]
  );

  const resolvedOverlayClass = useMemo(
    () =>
      pickBySeed(
        OVERLAY_CLASSES,
        `${variantSeed}-overlay`,
        OVERLAY_CLASSES[0]
      ),
    [variantSeed]
  );

  const imageBrightness = useMemo(
    () => seededNumber(variantSeed, "brightness", 0.94, 1.02),
    [variantSeed]
  );

  const imageContrast = useMemo(
    () => seededNumber(variantSeed, "contrast", 1.03, 1.1),
    [variantSeed]
  );

  const imageSaturate = useMemo(
    () => seededNumber(variantSeed, "saturate", 0.98, 1.08),
    [variantSeed]
  );

  const [activeImage, setActiveImage] = useState(resolvedImage);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setActiveImage(resolvedImage);
    setImageFailed(false);
  }, [resolvedImage]);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#06070a] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(180deg,#0a0b10_0%,#06070a_100%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative grid gap-10 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.02fr_0.98fr] xl:items-center">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-500/10 px-4 py-2"
          >
            <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.9)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-100/90">
              {eyebrow}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, delay: 0.04 }}
            className="space-y-4"
          >
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-tight text-white md:text-5xl xl:text-6xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-8 text-white/78 md:text-[18px]">
              {subtitle}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, delay: 0.12 }}
            className="flex flex-col gap-3 pt-2 sm:flex-row"
          >
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#111318] shadow-[0_12px_30px_rgba(245,158,11,0.28)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
            >
              {primaryCtaLabel}
            </button>

            {showSecondaryCta && (
              <button
                type="button"
                onClick={onSecondaryClick}
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm transition duration-200 hover:bg-white/[0.07]"
              >
                {secondaryCtaLabel}
              </button>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="relative"
        >
          <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_58%)] blur-2xl" />

          <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0d12] shadow-[0_25px_70px_rgba(0,0,0,0.5)]">
            <div className={`absolute inset-0 bg-gradient-to-br ${resolvedOverlayClass}`} />
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />

            <div className="relative p-1 md:p-2">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/10">
                {!imageFailed ? (
                  <div className="relative aspect-[4/5] w-full">
                    <img
                      src={activeImage}
                      alt={imageAlt}
                      className="absolute inset-0 h-full w-full object-contain transition-transform duration-500"
                      style={{
                        objectPosition: "center center",
                        transform: "scale(1)",
                        filter: `brightness(${imageBrightness}) contrast(${imageContrast}) saturate(${imageSaturate})`,
                      }}
                      onError={() => {
                        if (activeImage !== DEFAULT_FALLBACK_IMAGE) {
                          setActiveImage(DEFAULT_FALLBACK_IMAGE);
                          return;
                        }
                        setImageFailed(true);
                      }}
                    />

                    <div className="absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.12),transparent_30%)]" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_35%),linear-gradient(180deg,#0c0f15_0%,#090b10_100%)] px-8 text-center">
                    <div className="max-w-md">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-200/90">
                        Visual unavailable
                      </p>
                      <h3 className="mt-3 text-2xl font-extrabold text-white">
                        Premium visual placeholder
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-white/62">
                        Add the beast base image to the project and this section will
                        show a premium seeded customer variant automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}