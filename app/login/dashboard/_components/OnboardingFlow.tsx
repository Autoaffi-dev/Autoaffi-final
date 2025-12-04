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
}: FlowArgs) {
 
  // ---------------------------------------------
  // 1. WELCOME → PERSONA
  // ---------------------------------------------
  function handleWelcomeContinue() {
    setTourStage("persona");
  }

  // ---------------------------------------------
  // 2. PERSONA → PATH
  // ---------------------------------------------
  function handlePersonaSelect(mode: CreatorMode) {
    choosePersona(mode);
    setTourStage("path");
  }

  // ---------------------------------------------
  // 3. PATH → SPOTLIGHT
  // ---------------------------------------------
  function handlePathSelect(path: "beginner" | "pro" | "elite") {
    setTourStage("spotlight");
  }

  // ---------------------------------------------
  // 4. SPOTLIGHT → FINAL STEPS
  // ---------------------------------------------
function handleSpotlightNext() {
  // Vi använder värdet vi redan har i props: spotlightIndex
  setSpotlightIndex(spotlightIndex + 1);
}
  // ---------------------------------------------
  // 5. FINAL STEPS → FINISH (SAVE TOUR)
  // ---------------------------------------------
  function handleFinalStepsContinue() {
    finishOnboarding();   // <-- SAVES autoaffi_tour_done = "1"
    setTourStage("complete");
  }

  return {
    stage,
    creatorMode,
    spotlightIndex,

    // FLOW ACTIONS
    handleWelcomeContinue,
    handlePersonaSelect,
    handlePathSelect,
    handleSpotlightNext,
    handleFinalStepsContinue,
  };
}