"use client";

import { splitForSpeech, takeSentences } from "../speechText";
import { PcmTimeline, STREAM_RATE, stopPcm } from "./pcmPlayer";

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

// PCM of finished server audio per answer, so replaying it costs no new TTS call.
const audioCache = new Map<string, Uint8Array>();
const MAX_CACHED = 20;

export function stopSpeaking(): void {
  generation++;
  stopPcm();
  if (speechSupported()) window.speechSynthesis.cancel();
}

function remember(text: string, pcm: Uint8Array) {
  if (!pcm.length) return;
  if (audioCache.size >= MAX_CACHED) audioCache.delete(audioCache.keys().next().value as string);
  audioCache.set(text, pcm);
}

function joinPcm(parts: Uint8Array[]): Uint8Array {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return all;
}

function requestSpeech(text: string): Promise<Response> {
  return fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

/** Feed it text as it arrives; it speaks each sentence as soon as the sentence is complete. */
export interface SpeechSession {
  add(delta: string): void;
  end(): void;
  /** Resolves when the session has decided how it spoke (or that it could not). */
  result: Promise<SpeakResult>;
}

/**
 * Starts reading text aloud with a Thai voice made on the server (many phones only ship an
 * English voice, which skips Thai and reads just the digits). Each sentence is requested as
 * soon as it is complete and played back to back on one timeline, so speech starts after
 * the first sentence instead of after the whole answer. Falls back to the phone voice if
 * the server could not produce any audio. `onDone` fires when playback ends.
 */
export function startSpeech(onDone: () => void, onBlocked?: () => void): SpeechSession {
  stopSpeaking();
  const mine = generation;
  const stale = () => mine !== generation;
  let resolveResult!: (r: SpeakResult) => void;
  const result = new Promise<SpeakResult>((r) => (resolveResult = r));

  let timeline: PcmTimeline;
  try {
    // Must run before any await so the audio unlock counts as part of the user tap.
    timeline = new PcmTimeline(STREAM_RATE, stale, onBlocked);
  } catch {
    let text = "";
    return {
      add: (d) => void (text += d),
      end: () => void speakThai(text, onDone).then(resolveResult),
      result,
    };
  }

  let buffer = "";
  let fullText = "";
  let failed = false;
  const parts: Uint8Array[] = [];
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (sentence: string) => {
    // Start the download now; play it only after the sentences before it.
    const pending = requestSpeech(sentence);
    chain = chain.then(async () => {
      if (stale() || failed) return;
      try {
        const res = await pending;
        if (!res.ok || !res.body) throw new Error(`tts ${res.status}`);
        parts.push(await timeline.appendStream(res.body));
      } catch {
        failed = true;
      }
    });
  };

  return {
    add(delta) {
      if (stale()) return;
      fullText += delta;
      buffer += delta;
      const { ready, rest } = takeSentences(buffer);
      buffer = rest;
      ready.forEach(enqueue);
    },
    end() {
      if (stale()) return resolveResult("ok");
      takeSentences(buffer, true).ready.forEach(enqueue);
      buffer = "";
      chain.then(() => {
        if (stale()) return resolveResult("ok");
        if (!timeline.hasAudio) {
          // Nothing came back from the server: use the phone voice for the whole answer.
          speakThai(fullText, onDone).then(resolveResult);
          return;
        }
        timeline.whenDone(() => {
          // A stopped reading also ends here; only a complete one is worth replaying.
          if (!failed && !stale()) remember(fullText.trim(), joinPcm(parts));
          onDone();
        });
        resolveResult("ok");
      });
    },
    result,
  };
}

/** Reads a finished text aloud: from the cache when possible, else sentence by sentence. */
export async function speak(text: string, onDone: () => void, onBlocked?: () => void): Promise<SpeakResult> {
  const cached = audioCache.get(text.trim());
  if (cached) {
    stopSpeaking();
    const mine = generation;
    try {
      const timeline = new PcmTimeline(STREAM_RATE, () => mine !== generation, onBlocked);
      timeline.appendPcm(cached);
      timeline.whenDone(onDone);
      return "ok";
    } catch {
      // Fall through to a fresh session.
    }
  }
  const session = startSpeech(onDone, onBlocked);
  session.add(text);
  session.end();
  return session.result;
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
