"use client";

import { useEffect, useRef } from "react";

type AISpeechProps = {
  text: string;
  play: boolean;

  // ✅ force re-speak when this changes
  speechKey?: string;

  // ✅ called when ALL chunks finished
  onDone?: () => void;
};

function pickVoice(synth: SpeechSynthesis) {
  const voices = synth.getVoices();

  // Prioritera Samantha om den finns
  return (
    voices.find((v) => v.name === "Samantha") ||
    voices.find((v) => v.name.toLowerCase().includes("female")) ||
    voices.find((v) => v.lang === "en-US") ||
    voices[0] ||
    null
  );
}

/**
 * ✅ Chunking fixes iOS/Safari truncation on long utterances.
 * We split by sentence-ish boundaries, max ~160 chars per chunk.
 */
function chunkText(raw: string, maxLen = 160) {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return [];

  // split on sentence boundaries (., !, ?, newline)
  const parts = text.split(/(?<=[.!?])\s+/g);

  const out: string[] = [];
  let buf = "";

  for (const p of parts) {
    const piece = p.trim();
    if (!piece) continue;

    if ((buf + " " + piece).trim().length <= maxLen) {
      buf = (buf + " " + piece).trim();
    } else {
      if (buf) out.push(buf);

      // if one sentence is huge, hard-split
      if (piece.length > maxLen) {
        let i = 0;
        while (i < piece.length) {
          out.push(piece.slice(i, i + maxLen));
          i += maxLen;
        }
        buf = "";
      } else {
        buf = piece;
      }
    }
  }

  if (buf) out.push(buf);
  return out;
}

export default function AISpeech({ text, play, speechKey, onDone }: AISpeechProps) {
  const cancelledRef = useRef(false);

  // ✅ Anti-loop guards
  const lastStartedKeyRef = useRef<string>("");      // do not restart same speechKey
  const speakingRunIdRef = useRef<number>(0);        // only one active queue run
  const voicesHandlerRef = useRef<((this: SpeechSynthesis, ev: Event) => any) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;
    cancelledRef.current = false;

    const key = String(speechKey ?? "");

    // stop any current speech if we’re not playing
    if (!play || !text) {
      try {
        synth.cancel();
      } catch {}
      return;
    }

    // ✅ Guard 1: same key should NEVER restart (fixar repetition / StrictMode)
    if (key && lastStartedKeyRef.current === key) {
      return;
    }

    // ✅ mark this key as started
    if (key) lastStartedKeyRef.current = key;

    // ✅ Guard 2: this run gets a unique id; only latest run may continue
    const runId = Date.now() + Math.floor(Math.random() * 1000000);
    speakingRunIdRef.current = runId;

    // Always cancel before starting new queue
    try {
      synth.cancel();
    } catch {}

    const chunks = chunkText(text, 160);
    if (chunks.length === 0) return;

    const speakQueue = () => {
      // only latest run can speak
      if (cancelledRef.current) return;
      if (speakingRunIdRef.current !== runId) return;

      const voice = pickVoice(synth);
      let idx = 0;

      const speakNext = () => {
        if (cancelledRef.current) return;
        if (speakingRunIdRef.current !== runId) return;

        // finished all chunks
        if (idx >= chunks.length) {
          onDone?.();
          return;
        }

        const utter = new SpeechSynthesisUtterance(chunks[idx]);
        if (voice) utter.voice = voice;

        // Premium settings (dina)
        utter.rate = 0.9;
        utter.pitch = 1.15;
        utter.volume = 1;

        utter.onend = () => {
          if (cancelledRef.current) return;
          if (speakingRunIdRef.current !== runId) return;
          idx += 1;
          // tiny delay helps Safari chain reliably
          window.setTimeout(speakNext, 35);
        };

        utter.onerror = () => {
          if (cancelledRef.current) return;
          if (speakingRunIdRef.current !== runId) return;
          // skip this chunk and continue
          idx += 1;
          window.setTimeout(speakNext, 35);
        };

        try {
          synth.speak(utter);
        } catch {
          // fail safe: move on
          idx += 1;
          window.setTimeout(speakNext, 35);
        }
      };

      speakNext();
    };

    // voices may load async on iOS
    if (synth.getVoices().length > 0) {
      speakQueue();
    } else {
      // cleanup any old handler first
      try {
        if (voicesHandlerRef.current) synth.onvoiceschanged = null;
      } catch {}

      const handler = () => {
        // only latest run can proceed
        if (cancelledRef.current) return;
        if (speakingRunIdRef.current !== runId) return;
        speakQueue();
      };

      voicesHandlerRef.current = handler;
      try {
        synth.onvoiceschanged = handler;
      } catch {}

      // fallback: try after a short delay too
      window.setTimeout(() => {
        if (cancelledRef.current) return;
        if (speakingRunIdRef.current !== runId) return;
        speakQueue();
      }, 250);
    }

    return () => {
      cancelledRef.current = true;

      // invalidate this run
      if (speakingRunIdRef.current === runId) {
        speakingRunIdRef.current = 0;
      }

      try {
        synth.cancel();
      } catch {}

      // cleanup handler
      try {
        synth.onvoiceschanged = null;
      } catch {}
      voicesHandlerRef.current = null;
    };
  }, [play, text, speechKey, onDone]);

  return null;
}