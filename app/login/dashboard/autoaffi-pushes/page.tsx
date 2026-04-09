"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import PushActionsBar from "./_components/PushActionsBar";
import PushInputPanel from "./_components/PushInputPanel";
import PushResultsPanel from "./_components/PushResultsPanel";
import PushesHeader from "./_components/PushesHeader";
import PushTypeSelector from "./_components/PushTypeSelector";
import SavedPushesPanel from "./_components/SavedPushesPanel";
import type {
  GeneratedPush,
  PushCTAIntensity,
  PushGoal,
  PushLanguage,
  PushPlatform,
  PushTargetMarket,
  PushType,
  SavedPush,
  TopicInputMode,
} from "./types";
import { validatePushInput } from "@/lib/autoaffi-pushes/validators";
import {
  getRecommendedGoal,
  getRecommendedPushType,
  SUGGESTED_TOPICS,
} from "@/lib/autoaffi-pushes/constants";

export default function AutoaffiPushesPage() {
  const { data: session } = useSession();

  const recommendedPushType = getRecommendedPushType();

  const [pushType, setPushType] = useState<PushType>(recommendedPushType);
  const [platform, setPlatform] = useState<PushPlatform>("instagram");
  const [topicInputMode, setTopicInputMode] =
    useState<TopicInputMode>("suggested");
  const [topic, setTopic] = useState<string>(SUGGESTED_TOPICS[0]);
  const [offerFocus, setOfferFocus] = useState("");
  const [goal, setGoal] = useState<PushGoal>(
    getRecommendedGoal(recommendedPushType)
  );
  const [durationDays, setDurationDays] = useState<5 | 7>(5);
  const [ctaIntensity, setCTAIntensity] =
    useState<PushCTAIntensity>("medium");
  const [targetMarket, setTargetMarket] =
    useState<PushTargetMarket>("international_english");
  const [language, setLanguage] = useState<PushLanguage>("english");

  const [result, setResult] = useState<GeneratedPush | null>(null);
  const [error, setError] = useState<string>("");
  const [savedPushes, setSavedPushes] = useState<SavedPush[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingDay, setIsRegeneratingDay] = useState<number | null>(null);

  const userId = (session?.user as any)?.id || null;

  const recommendedGoal = useMemo(
    () => getRecommendedGoal(pushType),
    [pushType]
  );

  useEffect(() => {
    setGoal(recommendedGoal);
  }, [recommendedGoal]);

  useEffect(() => {
    if (topicInputMode === "suggested" && !topic.trim()) {
      setTopic(SUGGESTED_TOPICS[0]);
    }
  }, [topicInputMode, topic]);

  const currentInput = useMemo(
    () => ({
      pushType,
      platform,
      topic: topic.trim(),
      offerFocus: offerFocus.trim(),
      goal,
      durationDays,
      ctaIntensity,
      targetMarket,
      language,
    }),
    [
      pushType,
      platform,
      topic,
      offerFocus,
      goal,
      durationDays,
      ctaIntensity,
      targetMarket,
      language,
    ]
  );

  useEffect(() => {
    async function loadSavedPushes() {
      if (!userId) return;

      try {
        setIsLoadingSaved(true);

        const res = await fetch(
          `/api/autoaffi-pushes?userId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          console.error("[AUTOAFFI_PUSHES] load failed", data?.error);
          return;
        }

        setSavedPushes(Array.isArray(data.pushes) ? data.pushes : []);
      } catch (err) {
        console.error("[AUTOAFFI_PUSHES] load crash", err);
      } finally {
        setIsLoadingSaved(false);
      }
    }

    loadSavedPushes();
  }, [userId]);

  async function runGeneration() {
    const validation = validatePushInput(currentInput);
    if (!validation.ok) {
      setError(validation.errors[0] || "Invalid input.");
      return;
    }

    if (!userId) {
      setError("Missing user session. Please refresh and try again.");
      return;
    }

    try {
      setIsGenerating(true);
      setError("");

      const res = await fetch("/api/autoaffi-pushes/generate-unique", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          input: currentInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.push) {
        setError(data?.error || "Failed to generate unique push.");
        return;
      }

      setResult(data.push as GeneratedPush);
    } catch (err: any) {
      setError(err?.message || "Failed to generate push.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGenerate() {
    runGeneration();
  }

  function handleRegenerate() {
    runGeneration();
  }

  async function handleRegenerateDay(dayNumber: number) {
    if (!result || !userId) return;

    try {
      setIsRegeneratingDay(dayNumber);
      setError("");

      const res = await fetch("/api/autoaffi-pushes/regenerate-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          input: currentInput,
          dayNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.day) {
        setError(data?.error || "Failed to regenerate day.");
        return;
      }

      const nextDay = data.day;

      const nextDays = result.days.map((day) =>
        day.dayNumber === dayNumber ? nextDay : day
      );

      setResult({
        ...result,
        days: nextDays,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to regenerate day.");
    } finally {
      setIsRegeneratingDay(null);
    }
  }

  async function handleSave() {
    if (!result || !userId) return;

    try {
      setIsSaving(true);

      const res = await fetch("/api/autoaffi-pushes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          push: result,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to save push.");
        return;
      }

      const savedItem: SavedPush = {
        id: data.id,
        userId,
        createdAt: data.createdAt || new Date().toISOString(),
        push: result,
      };

      setSavedPushes((prev) => [savedItem, ...prev]);
    } catch (err: any) {
      setError(err?.message || "Failed to save push.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenSaved(item: SavedPush) {
    setResult(item.push);
    setPushType(item.push.pushType);
    setPlatform(item.push.platform);
    setTopic(item.push.topic);
    setTopicInputMode("manual");
    setOfferFocus(item.push.offerFocus || "");
    setGoal(item.push.goal);
    setDurationDays(item.push.durationDays);
    setCTAIntensity(item.push.ctaIntensity);
    setTargetMarket(item.push.targetMarket || "international_english");
    setLanguage(item.push.language || "english");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#07070a] text-white px-6 md:px-12 pt-24 pb-20">
      <div className="max-w-6xl mx-auto">
        <PushesHeader />

        <div className="mt-12 space-y-6">
          <PushTypeSelector value={pushType} onChange={setPushType} />

          <PushInputPanel
            pushType={pushType}
            platform={platform}
            onPlatformChange={setPlatform}
            topic={topic}
            onTopicChange={setTopic}
            topicInputMode={topicInputMode}
            onTopicInputModeChange={setTopicInputMode}
            offerFocus={offerFocus}
            onOfferFocusChange={setOfferFocus}
            goal={goal}
            onGoalChange={setGoal}
            recommendedGoal={recommendedGoal}
            durationDays={durationDays}
            onDurationChange={setDurationDays}
            ctaIntensity={ctaIntensity}
            onCTAIntensityChange={setCTAIntensity}
            targetMarket={targetMarket}
            onTargetMarketChange={setTargetMarket}
            language={language}
            onLanguageChange={setLanguage}
            onGenerate={handleGenerate}
          />

          {(isGenerating || isRegeneratingDay !== null) && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {isGenerating
                ? "Generating unique push..."
                : `Regenerating unique day ${isRegeneratingDay}...`}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <>
              <PushActionsBar push={result} onRegenerate={handleRegenerate} />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !userId}
                  className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-400/15 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save push"}
                </button>
              </div>

              <PushResultsPanel
                push={result}
                onRegenerateDay={handleRegenerateDay}
              />
            </>
          )}

          {isLoadingSaved ? (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-[0_0_30px_rgba(0,0,0,0.24)]">
              <p className="text-sm text-white/55">Loading saved pushes...</p>
            </section>
          ) : (
            <SavedPushesPanel pushes={savedPushes} onOpen={handleOpenSaved} />
          )}
        </div>
      </div>
    </main>
  );
}