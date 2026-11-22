"use client";

import { splitForSpeech } from "../speechText";
import { pcmToWav, rateFromMime } from "../wav";
import { playPcmStream, primeAudio, stopPcm } from "./pcmPlayer";

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

let currentAudio: HTMLAudioElement | null = null;
// Object URLs of finished server audio, so replaying an answer costs no new TTS call.
const audioCache = new Map<string, string>();
const MAX_CACHED = 20;

export function stopSpeaking(): void {
  generation++;
  currentAudio?.pause();
  currentAudio = null;
  stopPcm();
  if (speechSupported()) window.speechSynthesis.cancel();
}

function remember(text: string, pcm: Uint8Array, rate: number) {
  if (audioCache.size >= MAX_CACHED) {
    const [oldText, oldUrl] = audioCache.entries().next().value as [string, string];
    URL.revokeObjectURL(oldUrl);
    audioCache.delete(oldText);
  }
  const wav = pcmToWav(pcm, rate);
  audioCache.set(text, URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" })));
}

async function playUrl(url: string, onDone: () => void) {
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => onDone();
  audio.onerror = () => onDone();
  await audio.play();
}

/**
 * Reads text aloud with a Thai voice made on the server (many phones only ship an English
 * voice, which skips Thai and reads just the digits). The audio streams in and starts
 * playing after the first chunk. Falls back to the phone's own voice if the server cannot
 * make audio. `onDone` fires when playback ends.
 */
export async function speak(text: string, onDone: () => void): Promise<SpeakResult> {
  stopSpeaking();
  const mine = generation;
  // Must run before any await so the audio unlock counts as part of the user's tap.
  primeAudio();
  try {
    const cached = audioCache.get(text);
    if (cached) {
      await playUrl(cached, onDone);
      return "ok";
    }
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !res.body) throw new Error(`tts ${res.status}`);
    if (mine !== generation) return "ok";
    const rate = rateFromMime(res.headers.get("content-type") ?? undefined);
    const pcm = await playPcmStream(res.body, rate, () => mine !== generation, onDone);
    if (pcm.length && mine === generation) remember(text, pcm, rate);
    return "ok";
  } catch {
    // A newer tap already took over; do not start the fallback voice behind it.
    if (mine !== generation) return "ok";
    return speakThai(text, onDone);
  }
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
