"use client";

import type { Lang } from "./types";

const SPEECH_LANG: Record<Lang, string> = {
  bn: "bn-IN",
  hi: "hi-IN",
  en: "en-IN",
};

export function stopBrowserSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function speakWithBrowser(text: string, lang: Lang): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return Promise.resolve();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = SPEECH_LANG[lang] || "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
