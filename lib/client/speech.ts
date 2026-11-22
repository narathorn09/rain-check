"use client";

import { splitForSpeech } from "../speechText";

export type SpeakResult = "ok" | "unsupported" | "no-thai-voice";

let generation = 0;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  // Chrome fills the voice list asynchronously on first use.
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  generation++;
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * Reads Thai text aloud in short chunks. `onDone` fires once, when reading ends or is stopped.
 * Still tries to speak without a Thai voice (the engine may handle th-TH anyway), but
 * reports it so the UI can explain how to install one.
 */
export async function speakThai(text: string, onDone: () => void): Promise<SpeakResult> {
  if (!speechSupported()) return "unsupported";
  const synth = window.speechSynthesis;
  stopSpeaking();
  const mine = generation;

  const voices = await loadVoices();
  const thai = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("th"));
  // A stale call (user tapped again while voices loaded) must not start talking.
  if (mine !== generation) return "ok";

  const chunks = splitForSpeech(text);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone();
  };

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "th-TH";
    if (thai) u.voice = thai;
    u.rate = 0.9;
    const last = i === chunks.length - 1;
    // Callbacks from a cancelled generation are ignored so they cannot reset newer state.
    u.onend = () => {
      if (mine !== generation || last) finish();
    };
    u.onerror = () => finish();
    synth.speak(u);
  });
  // Android Chrome can leave the queue paused after a previous cancel.
  synth.resume();
  if (chunks.length === 0) finish();
  return thai ? "ok" : "no-thai-voice";
}
