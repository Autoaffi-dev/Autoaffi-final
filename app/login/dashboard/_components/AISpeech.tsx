"use client";

import { useEffect } from "react";

type AISpeechProps = {
  text: string;
  play: boolean;
};

export default function AISpeech({ text, play }: AISpeechProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;
    synth.cancel();
    if (!play || !text) return;

    const speak = () => {
      const utter = new SpeechSynthesisUtterance(text);

      const voices = synth.getVoices();

      // ★ FIXAR ALLT: Välj SAMANTHA om den finns
      let voice =
        voices.find((v) => v.name === "Samantha") ||
        voices.find((v) => v.name.toLowerCase().includes("female")) ||
        voices.find((v) => v.lang === "en-US") ||
        voices[0];

      utter.voice = voice;

      // Premium AI-röst
      utter.rate = 0.9; // långsamt, mjukt
      utter.pitch = 1.2; // feminin ton
      utter.volume = 1;

      synth.speak(utter);
    };

    if (synth.getVoices().length > 0) speak();
    else window.speechSynthesis.onvoiceschanged = speak;

    return () => synth.cancel();
  }, [text, play]);

  return null;
}