"use client";

import { CreatorMode, TourStage } from "../page";

type FlowArgs = {
  stage: TourStage;
  setTourStage: (s: TourStage) => void;
  choosePersona: (mode: CreatorMode) => void;
  creatorMode: CreatorMode;
  spotlightIndex: number;
  setSpotlightIndex: (n: number) => void;
  finishOnboarding: () => void;
  setAiMessage: (t: string) => void;

  // OPTIONAL: start advanced tour later (Tour 2)
  startAdvancedTour?: () => void;
};

export default function OnboardingFlow({
  stage,
  setTourStage,
  choosePersona,
  creatorMode,
  spotlightIndex,
  setSpotlightIndex,
  finishOnboarding,
  setAiMessage,
  startAdvancedTour,
}: FlowArgs) {
  // ---------------------------------------------
  // 1) WELCOME → PERSONA
  // ---------------------------------------------
  function handleWelcomeContinue() {
    setAiMessage(
      "Perfect. First we choose your creator style — then I’ll show you your first 3 steps so you get momentum fast."
    );
    setTourStage("persona");
  }

  // ---------------------------------------------
  // 2) PERSONA → PATH
  // NOTE: choosePersona() must NOT set aiMessage
  // ---------------------------------------------
  function handlePersonaSelect(mode: CreatorMode) {
    choosePersona(mode);

    setAiMessage(
      "Great choice. Now pick your starting path — this sets what you’ll see first and how I guide you."
    );
    setTourStage("path");
  }

  // ---------------------------------------------
  // 3) PATH → FINAL STEPS (FIRST WIN)
  // ---------------------------------------------
  function handlePathSelect(path: "beginner" | "pro" | "elite") {
    setAiMessage(
      "Awesome. Now: your first win. Complete these 3 steps to unlock momentum and smarter guidance."
    );
    setTourStage("final-steps");
  }

  // ---------------------------------------------
  // 4) OPTIONAL ADVANCED TOUR (SPOTLIGHT)
  // ---------------------------------------------
  function handleStartAdvancedTour() {
    setAiMessage(
      "Alright — this is the advanced walkthrough. I’ll quickly show you where everything lives so you always know what to do next."
    );
    setSpotlightIndex(0);
    setTourStage("spotlight");
    startAdvancedTour?.();
  }

  // ---------------------------------------------
  // 5) FINAL STEPS → FINISH (SAVE TOUR)
  // ---------------------------------------------
  function handleFinalStepsContinue() {
    finishOnboarding(); // saves autoaffi_tour_done = "1"
    setTourStage("complete");
  }

  // ---------------------------------------------
  // Spotlight next
  // ---------------------------------------------
  function handleSpotlightNext() {
    setSpotlightIndex(spotlightIndex + 1);
  }

  return {
    stage,
    creatorMode,
    spotlightIndex,

    handleWelcomeContinue,
    handlePersonaSelect,
    handlePathSelect,
    handleSpotlightNext,
    handleFinalStepsContinue,

    // optional
    handleStartAdvancedTour,
  };
}