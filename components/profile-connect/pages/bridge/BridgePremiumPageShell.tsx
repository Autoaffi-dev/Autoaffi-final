"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  creatorName?: string;
  premiumTitle?: string;
  premiumSubtitle?: string;
  premiumImageUrl?: string;
  premiumImageAlt?: string;
  premiumBullets?: string[];
  fitBullets?: string[];
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
};

const DEFAULT_FALLBACK_IMAGE =
  "/images/profile-connect/bridge-premium-hero.jpg";

function normalizeImageUrl(url?: string) {
  const value = (url || "").trim();
  if (!value) return DEFAULT_FALLBACK_IMAGE;
  return value;
}

function buildGuideHref(pathname: string, search: URLSearchParams | null) {
  const cleanPath = pathname.replace(/\/+$/, "");

  if (cleanPath.endsWith("/premium")) {
    const params = search?.toString() || "";
    return `${cleanPath.replace(/\/premium$/, "")}${params ? `?${params}` : ""}`;
  }

  if (cleanPath.endsWith("/story")) {
    const params = search?.toString() || "";
    return `${cleanPath.replace(/\/story$/, "")}${params ? `?${params}` : ""}`;
  }

  const params = search?.toString() || "";
  return `${cleanPath}${params ? `?${params}` : ""}`;
}

export default function BridgePremiumPageShell({
  creatorName = "Me",
  premiumTitle = "This is the premium next step I would recommend if you want a clearer and stronger way forward",
  premiumSubtitle = "Built for people who want better tools, simpler systems and a next step that feels more serious, more intentional and easier to trust.",
  premiumImageUrl = DEFAULT_FALLBACK_IMAGE,
  premiumImageAlt = "Premium setup recommendation",
  premiumBullets = [
    "A clearer workflow that feels easier to follow",
    "A more structured way to move forward",
    "Better-fit tools instead of random trial and error",
    "A stronger premium next step when you are ready",
  ],
  fitBullets = [
    "People who want a clearer structure",
    "Creators who want better-fit tools",
    "Anyone who wants less noise and better direction",
    "People ready for a more serious next step",
  ],
  onPrimaryClick,
  onSecondaryClick,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safePathname = pathname || "";

  const guideHref = useMemo(
    () => buildGuideHref(safePathname, searchParams),
    [safePathname, searchParams]
  );

  const [activeImage, setActiveImage] = useState(
    normalizeImageUrl(premiumImageUrl)
  );
  const [imageFailed, setImageFailed] = useState(false);

  function handlePrimaryClick() {
    if (onPrimaryClick) {
      onPrimaryClick();
      return;
    }

    const fallback = searchParams?.get("next");
    if (fallback) {
      router.push(fallback);
    }
  }

  function handleSecondaryClick() {
    if (onSecondaryClick) {
      onSecondaryClick();
      return;
    }

    if (guideHref) {
      router.push(guideHref);
    }
  }

  return (
    <main className="min-h-screen bg-[#040509] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.11),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,#06070a_0%,#040509_100%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-6 md:pb-20 md:pt-8 xl:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#06070a] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(180deg,#0a0b10_0%,#06070a_100%)]" />

          <div className="relative grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.02fr_0.98fr] xl:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-5"
            >
              <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-100/90">
                RECOMMENDED NEXT STEP
              </div>

              <div>
                <p className="text-sm font-semibold text-yellow-200/90">
                  Recommended by {creatorName}
                </p>
                <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl">
                  {premiumTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                  {premiumSubtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {premiumBullets.slice(0, 4).map((bullet, index) => (
                  <div
                    key={`${bullet}-${index}`}
                    className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-sm leading-6 text-white/74">{bullet}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePrimaryClick}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#101218] shadow-[0_12px_30px_rgba(245,158,11,0.24)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
                >
                  Start with the Premium Setup
                </button>

                <button
                  type="button"
                  onClick={handleSecondaryClick}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm transition duration-200 hover:bg-white/[0.07]"
                >
                  Go Back to the Guide
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_58%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0d12] shadow-[0_25px_70px_rgba(0,0,0,0.5)]">
                {!imageFailed ? (
                  <img
                    src={activeImage}
                    alt={premiumImageAlt}
                    className="h-[420px] w-full object-cover md:h-[560px]"
                    onError={() => {
                      if (activeImage !== DEFAULT_FALLBACK_IMAGE) {
                        setActiveImage(DEFAULT_FALLBACK_IMAGE);
                        return;
                      }
                      setImageFailed(true);
                    }}
                  />
                ) : (
                  <div className="flex h-[420px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.10),transparent_35%),linear-gradient(180deg,#0c0f15_0%,#090b10_100%)] px-8 text-center md:h-[560px]">
                    <div className="max-w-md">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-200/90">
                        Autoaffi premium visual
                      </p>
                      <h3 className="mt-3 text-2xl font-extrabold text-white">
                        Premium recommendation image placeholder
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-white/62">
                        The selected premium image could not be loaded yet. Use a real image URL,
                        generated image, or curated Autoaffi image that exists in your project.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
              Why this feels worth testing
            </div>

            <div className="mt-5 grid gap-3">
              {premiumBullets.map((bullet, index) => (
                <div
                  key={`${bullet}-full-${index}`}
                  className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                >
                  <p className="text-sm leading-6 text-white/74">{bullet}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="space-y-6"
          >
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
                Who this may fit best
              </div>

              <div className="mt-5 grid gap-3">
                {fitBullets.map((bullet, index) => (
                  <div
                    key={`${bullet}-${index}`}
                    className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                  >
                    <p className="text-sm leading-6 text-white/74">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Why I would recommend this next
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Clearer structure</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    A more intentional next step with less confusion.
                  </p>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Better fit</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    A stronger move than random testing and scattered choices.
                  </p>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">More serious next step</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Built for people who want to move forward with more clarity.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePrimaryClick}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-3 text-sm font-extrabold text-[#101218] shadow-[0_12px_30px_rgba(245,158,11,0.24)] transition duration-200 hover:scale-[1.01] hover:brightness-110"
                >
                  Start with the Premium Setup
                </button>

                <button
                  type="button"
                  onClick={handleSecondaryClick}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm transition duration-200 hover:bg-white/[0.07]"
                >
                  Go Back to the Guide
                </button>
              </div>

              <p className="mt-4 text-center text-xs tracking-[0.14em] text-white/42 uppercase">
                Premium recommendation • Better fit • Simpler path forward
              </p>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}