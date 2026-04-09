"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import Step1_Positioning from "@/components/dashboard/cards/profile-connect/wizard/steps/Step1_Positioning";
import Step2_ProfilePhoto from "@/components/dashboard/cards/profile-connect/wizard/steps/Step2_ProfilePhoto";
import Step3_BioBuilder from "@/components/dashboard/cards/profile-connect/wizard/steps/Step3_BioBuilder";
import Step4_LinkTracking from "@/components/dashboard/cards/profile-connect/wizard/steps/Step4_LinkTracking";
import Step5_ProofLayer from "@/components/dashboard/cards/profile-connect/wizard/steps/Step5_ProofLayer";
import Step6_PinnedTrio from "@/components/dashboard/cards/profile-connect/wizard/steps/Step6_PinnedTrio";
import Step7_CTA_Automation from "@/components/dashboard/cards/profile-connect/wizard/steps/Step7_CTA_Automation";
import Step8_FinalKit from "@/components/dashboard/cards/profile-connect/wizard/steps/Step8_FinalKit";
import ProfileConnectPreviewPanel from "../preview/ProfileConnectPreviewPanel";

import type {
  PlatformKey,
  StepKey,
  StepPayload,
} from "@/lib/profile-connect/engine/types";

type Props = {
  selectedPlatform: PlatformKey;
  onClose: () => void;
  onCompleted: (platform: PlatformKey) => void | Promise<void>;
  onSaved: () => void | Promise<void>;
};

const STEPS: { key: StepKey; label: string }[] = [
  { key: "positioning", label: "Profile Name" },
  { key: "photo", label: "Profile Image" },
  { key: "bio", label: "Bio" },
  { key: "link", label: "Link Setup" },
  { key: "proof", label: "Proof Package" },
  { key: "pinned", label: "Pinned Assets" },
  { key: "cta", label: "Reply System" },
  { key: "final_kit", label: "Final Kit" },
];

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function ProfileConnectWizard({
  selectedPlatform,
  onClose,
  onCompleted,
  onSaved,
}: Props) {
  const [sessionId] = useState(makeSessionId);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payloads, setPayloads] = useState<Partial<Record<StepKey, StepPayload>>>({});
  const [stepState, setStepState] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeWhy, setCompleteWhy] = useState<string[]>([]);
  const [score, setScore] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const progress = Math.round(((currentStepIndex + 1) / STEPS.length) * 100);
  const currentPayload = payloads[currentStep.key];

  const completedStepsCount = useMemo(() => {
    return STEPS.reduce((acc, s) => {
      if (stepState?.[s.key]?.done || stepState?.[s.key]?.completed) return acc + 1;
      return acc;
    }, 0);
  }, [stepState]);

  async function fetchState() {
    const res = await fetch(`/api/profile-connect/state/get?platform=${selectedPlatform}`, {
      method: "GET",
      cache: "no-store",
    });

    const json = await res.json();

    if (json?.ok && json.state) {
      setStepState(json.state.step_state || json.state || {});
      setScore(json.state.score || json.score || 0);
    } else {
      setStepState({});
      setScore(0);
    }
  }

  async function bootstrap() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile-connect/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          session_id: sessionId,
          locale: "en",
        }),
      });

      const json = await res.json();

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to bootstrap wizard");
      }

      const firstStep = json.first_step as StepPayload | undefined;

      if (firstStep?.step) {
        setPayloads((prev) => ({
          ...prev,
          [firstStep.step]: firstStep,
        }));
      }

      if (json?.state) {
        setStepState(json.state.step_state || json.state || {});
      }

      await fetchState();
    } catch (e: any) {
      setError(e?.message || "Failed to bootstrap wizard");
    } finally {
      setLoading(false);
    }
  }

  async function loadStep(step: StepKey, forceNew = false) {
    if (step === "final_kit") return;
    if (!forceNew && payloads[step]) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile-connect/step/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          step,
          rotation_mode: "session",
          session_id: sessionId,
          force_new: forceNew,
        }),
      });

      const json = await res.json();

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load step");
      }

      const payload = json.payload as StepPayload;

      setPayloads((prev) => ({
        ...prev,
        [step]: payload,
      }));
    } catch (e: any) {
      setError(e?.message || "Failed to load step");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform]);

  useEffect(() => {
    const step = STEPS[currentStepIndex]?.key;
    if (step && step !== "final_kit" && !payloads[step]) {
      loadStep(step);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, payloads, selectedPlatform]);

  async function savePatch(patch: Record<string, any>) {
    setSaving(true);
    setError(null);

    const optimistic = { ...stepState, ...patch };
    setStepState(optimistic);

    try {
      const res = await fetch("/api/profile-connect/state/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          step_state_patch: patch,
        }),
      });

      const json = await res.json();

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to save step");
      }

      setStepState(json.state?.step_state || json.state || optimistic);
      await onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndContinue(patch: Record<string, any>) {
    await savePatch(patch);
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }

  async function regenerateCurrentStep() {
    if (currentStep.key === "final_kit") return;
    await loadStep(currentStep.key, true);
  }

  async function handleComplete() {
    setSaving(true);
    setCompleteError(null);
    setCompleteWhy([]);

    try {
      const res = await fetch("/api/profile-connect/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
        }),
      });

      const json = await res.json();

      if (!json?.ok) {
        setCompleteError(json?.reasons?.join(" ") || json?.error || "Unable to complete setup");
        setCompleteWhy(json?.why || []);
        setScore(json?.score || 0);
        return false;
      }

      setScore(json.score || 0);
      setCompleteWhy(json.why || []);
      await onCompleted(selectedPlatform);
      return true;
    } catch (e: any) {
      setCompleteError(e?.message || "Unable to complete setup");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  const stepCommonProps = {
    platform: selectedPlatform,
    stepState,
    saving,
    onSave: savePatch,
    onSaveAndContinue: saveAndContinue,
  };

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#050507] shadow-[0_0_60px_rgba(0,0,0,0.45)]"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.22 }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.08),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_22%)]" />

        <div className="relative z-10 flex h-full max-h-[92vh] flex-col">
          <div className="border-b border-white/10 px-5 py-4 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
                  Profile Setup
                </div>
                <h3 className="text-xl font-extrabold text-white md:text-2xl">
                  {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Copy-Paste Setup
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  Autoaffi gives you the exact copy, visuals and reply system you need. Just choose,
                  copy and paste.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
                  {completedStepsCount}/{STEPS.length} steps ready
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreview((prev) => !prev)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                    showPreview
                      ? "border border-yellow-400/25 bg-yellow-500/10 text-yellow-100"
                      : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                  }`}
                >
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.06]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/35">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STEPS.map((step, index) => {
                const active = index === currentStepIndex;
                const done = !!(stepState?.[step.key]?.done || stepState?.[step.key]?.completed);

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setCurrentStepIndex(index)}
                    className={[
                      "rounded-full px-3 py-2 text-xs font-semibold transition-all",
                      active
                        ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                        : done
                        ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                        : "border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {done ? "✅ " : ""}
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
            {loading && currentStep.key !== "final_kit" && !currentPayload ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">
                Loading step…
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">
                {error}
              </div>
            ) : (
              <>
                {currentStep.key === "positioning" && currentPayload && (
                  <Step1_Positioning {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "photo" && currentPayload && (
                  <Step2_ProfilePhoto {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "bio" && currentPayload && (
                  <Step3_BioBuilder {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "link" && currentPayload && (
                  <Step4_LinkTracking {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "proof" && currentPayload && (
                  <Step5_ProofLayer {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "pinned" && currentPayload && (
                  <Step6_PinnedTrio {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "cta" && currentPayload && (
                  <Step7_CTA_Automation {...stepCommonProps} payload={currentPayload} />
                )}

                {currentStep.key === "final_kit" && (
                  <Step8_FinalKit
                    platform={selectedPlatform}
                    stepState={stepState}
                    saving={saving}
                    onComplete={handleComplete}
                  />
                )}

                {showPreview && (
                  <div className="mt-6">
                    <ProfileConnectPreviewPanel stepState={stepState} />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-4 md:px-6">
            {completeError ? (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                <p className="font-semibold">Setup not ready to complete yet.</p>
                <p className="mt-1">{completeError}</p>

                {completeWhy.length > 0 && (
                  <div className="mt-3 space-y-1 text-red-100/90">
                    {completeWhy.map((item, index) => (
                      <p key={index}>• {item}</p>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs text-red-100/70">Current score: {score}/100</p>
              </div>
            ) : completeWhy.length > 0 && score >= 90 ? (
              <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">Ready to complete.</p>
                <div className="mt-2 space-y-1">
                  {completeWhy.map((item, index) => (
                    <p key={index}>• {item}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStepIndex === 0 || saving}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {currentStep.key !== "final_kit" ? (
                <button
                  type="button"
                  onClick={regenerateCurrentStep}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Regenerate Copy
                </button>
              ) : (
                <div className="text-xs text-white/45">
                  Final step: copy everything into the right place on your platform.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}