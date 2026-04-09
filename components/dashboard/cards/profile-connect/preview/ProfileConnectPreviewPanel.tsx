"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ProfileConnectPagePreview from "@/components/profile-connect/pages/ProfileConnectPagePreview";

type PreviewMode = "lead" | "bridge";
type BridgeStep = "intro" | "connection" | "premium";

type Props = {
  stepState: any;
};

export default function ProfileConnectPreviewPanel({ stepState }: Props) {
  const [bridgeStep, setBridgeStep] = useState<BridgeStep>("intro");

  const resolvedMode = useMemo<PreviewMode>(() => {
    return (stepState?.link?.primary_link_type || "lead") as PreviewMode;
  }, [stepState]);

  const title =
    resolvedMode === "lead"
      ? "Live Lead Page Preview"
      : bridgeStep === "intro"
      ? "Live Bridge Intro Preview"
      : bridgeStep === "connection"
      ? "Live Bridge Connection Preview"
      : "Live Bridge Premium Preview";

  const subtitle =
    resolvedMode === "lead"
      ? "This is the simpler first-step page your visitor sees."
      : bridgeStep === "intro"
      ? "This is the first personal bridge page your visitor lands on."
      : bridgeStep === "connection"
      ? "This is the deeper connection page that builds trust and personal connection."
      : "This is the premium recommendation page after the connection step.";

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/40">
              PROFILE CONNECT PREVIEW
            </p>
            <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
              {title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/64">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                resolvedMode === "lead"
                  ? "border border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
                  : "border border-white/10 bg-white/[0.03] text-white/60"
              }`}
            >
              Lead
            </div>

            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                resolvedMode === "bridge"
                  ? "border border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
                  : "border border-white/10 bg-white/[0.03] text-white/60"
              }`}
            >
              Bridge
            </div>
          </div>
        </div>

        {resolvedMode === "bridge" && (
          <div className="mt-5 flex flex-wrap gap-2">
            {(["intro", "connection", "premium"] as const).map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setBridgeStep(step)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                  bridgeStep === step
                    ? "border border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
                    : "border border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05]"
                }`}
              >
                {step}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.04 }}
        className="overflow-hidden rounded-[32px] border border-white/10 bg-[#040509] shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
      >
        <ProfileConnectPagePreview
          stepState={stepState}
          mode={resolvedMode}
          bridgeStep={bridgeStep}
          onGuideClick={() => {
            // preview only
          }}
          onStoryClick={() => {
            setBridgeStep("connection");
          }}
          onContinueClick={() => {
            setBridgeStep("premium");
          }}
          onPremiumClick={() => {
            // preview only
          }}
          onBackToGuideClick={() => {
            setBridgeStep("intro");
          }}
        />
      </motion.div>
    </div>
  );
}