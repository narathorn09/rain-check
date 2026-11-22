"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { Profile } from "../profile";
import type { Place } from "../types";
import { PcmTimeline, STREAM_RATE, primeAudio, stopPcm } from "./pcmPlayer";

export type CallState = "connecting" | "listening" | "speaking" | "ended" | "error";

export interface CallEvents {
  onState(state: CallState, message?: string): void;
  /** Running transcript of what the user is saying in the current turn. */
  onUserText(text: string, done: boolean): void;
  /** Running transcript of what น้องฝน is saying in the current turn. */
  onModelText(text: string, done: boolean): void;
}

// Live API input format: 16-bit mono PCM at 16 kHz, sent about every 100 ms.
const MIC_RATE = 16000;
const SEND_SAMPLES = MIC_RATE / 10;
// Keep the mic closed a moment after น้องฝน stops, so the tail of her voice is not heard back.
const ECHO_TAIL_MS = 350;

// Captures mic frames off the main thread and hands them to the page.
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("capture", Capture);
`;

/** Converts Float32 samples to little-endian 16-bit PCM, base64-encoded. */
export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Averages groups of samples down to `to` Hz (used when the mic context cannot run at 16 kHz). */
export function downsample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A spoken conversation with น้องฝน over Gemini Live. */
export class VoiceCall {
  private session: Session | null = null;
  private stream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private timeline: PcmTimeline | null = null;
  private closed = false;
  private speaking = false;
  private micOpenAt = 0;
  private pending: Float32Array[] = [];
  private pendingLen = 0;
  private userText = "";
  private modelText = "";

  constructor(private readonly events: CallEvents) {}

  /** Call from a tap: unlocks audio, asks for the mic, then connects. */
  async start(place: Place, profile: Profile): Promise<void> {
    this.events.onState("connecting");
    // Before any await, so the browser counts it as part of the tap.
    primeAudio();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-mic");
      this.stream = await navigator.mediaDevices
        .getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        .catch(() => {
          throw new Error("mic-denied");
        });
      if (this.closed) return this.cleanup();

      const res = await fetch("/api/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place, profile }),
      });
      if (!res.ok) throw new Error("token");
      const { token, model } = (await res.json()) as { token: string; model: string };
      if (this.closed) return this.cleanup();

      // An ephemeral token works like an API key, but only for Live and only on v1beta.
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1beta" } });
      this.session = await ai.live.connect({
        model,
        // The real settings are locked into the token on the server.
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (m) => this.onMessage(m),
          onerror: () => this.fail("connection"),
          onclose: () => this.end(),
        },
      });
      if (this.closed) return this.cleanup();

      await this.startMic();
      // Ask น้องฝน to open the call with a short greeting.
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "(เริ่มสาย ทักทายสั้นๆ แล้วถามว่าอยากรู้เรื่องฝนอะไร)" }] }],
        turnComplete: true,
      });
      this.events.onState("listening");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      this.fail(reason === "mic-denied" || reason === "no-mic" ? reason : "connection");
    }
  }

  /** Hangs up. Safe to call more than once. */
  stop(): void {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    this.events.onState("ended");
  }

  private end() {
    if (this.closed) return;
    this.stop();
  }

  private fail(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    this.events.onState("error", reason);
  }

  private cleanup() {
    try {
      this.session?.close();
    } catch {
      // Already closed.
    }
    this.session = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.micCtx?.close().catch(() => {});
    this.micCtx = null;
    stopPcm();
    this.timeline = null;
  }

  private async startMic() {
    if (!this.stream) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ sampleRate: MIC_RATE });
    } catch {
      ctx = new AudioContext();
    }
    this.micCtx = ctx;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, "capture");
    node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onMicFrame(downsample(e.data, ctx.sampleRate, MIC_RATE));
    src.connect(node);
    // The worklet must be pulled by the graph to run; route it to a muted output.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute).connect(ctx.destination);
  }

  private onMicFrame(frame: Float32Array) {
    if (!this.session || this.closed) return;
    // Half-duplex: while น้องฝน talks (and a moment after), the phone speaker would leak
    // into the mic and she would interrupt herself. Drop mic audio during that time.
    if (this.speaking || Date.now() < this.micOpenAt) {
      this.pending = [];
      this.pendingLen = 0;
      return;
    }
    this.pending.push(frame);
    this.pendingLen += frame.length;
    if (this.pendingLen < SEND_SAMPLES) return;
    const chunk = new Float32Array(this.pendingLen);
    let o = 0;
    for (const p of this.pending) {
      chunk.set(p, o);
      o += p.length;
    }
    this.pending = [];
    this.pendingLen = 0;
    this.session.sendRealtimeInput({ audio: { data: floatToPcm16Base64(chunk), mimeType: `audio/pcm;rate=${MIC_RATE}` } });
  }

  private setSpeaking(on: boolean) {
    if (this.speaking === on) return;
    this.speaking = on;
    if (!on) this.micOpenAt = Date.now() + ECHO_TAIL_MS;
    this.events.onState(on ? "speaking" : "listening");
  }

  private onMessage(m: LiveServerMessage) {
    if (this.closed) return;
    const sc = m.serverContent;
    if (m.goAway) {
      // The server is about to close the connection (time limit): end the call cleanly.
      this.end();
      return;
    }
    if (!sc) return;

    if (sc.interrupted) {
      stopPcm();
      this.timeline = null;
      this.setSpeaking(false);
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data) continue;
      try {
        this.timeline ??= new PcmTimeline(STREAM_RATE, () => this.closed);
      } catch {
        continue;
      }
      this.timeline.appendPcm(base64ToBytes(data));
      this.setSpeaking(true);
    }

    if (sc.inputTranscription?.text) {
      this.userText += sc.inputTranscription.text;
      this.events.onUserText(this.userText, false);
    }
    if (sc.outputTranscription?.text) {
      // A reply has started, so the user's turn is over.
      if (this.userText) {
        this.events.onUserText(this.userText, true);
        this.userText = "";
      }
      this.modelText += sc.outputTranscription.text;
      this.events.onModelText(this.modelText, false);
    }

    if (sc.turnComplete) {
      if (this.userText) this.events.onUserText(this.userText, true);
      if (this.modelText) this.events.onModelText(this.modelText, true);
      this.userText = "";
      this.modelText = "";
      // Reopen the mic only once her last word has actually played.
      const t = this.timeline;
      if (t) t.whenDone(() => !this.closed && this.timeline === t && this.setSpeaking(false));
      else this.setSpeaking(false);
    }
  }
}
