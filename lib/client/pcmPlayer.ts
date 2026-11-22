"use client";

import { Declicker } from "../declick";

// Plays streamed 16-bit mono PCM through one continuous AudioWorklet stream.
//
// An earlier version scheduled every chunk as its own AudioBufferSourceNode. Rendering that
// offline showed clean seams at 24 and 48 kHz but 28 hard clicks in 8 s at 44.1 kHz, the
// rate a phone falls back to when it refuses a forced rate. A single stream that resamples
// continuously has no seams at any device rate.

/** Rate of the speech audio from Gemini (TTS and Live). */
export const STREAM_RATE = 24000;

// Runs on the audio thread. Holds a queue of chunks and plays them as one stream, resampling
// from the input rate to the device rate with linear interpolation.
const WORKLET = `
class PcmStream extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.step = options.processorOptions.inRate / sampleRate;
    this.prebuffer = Math.round(options.processorOptions.inRate * options.processorOptions.prebufferSeconds);
    this.rampLen = Math.max(1, Math.round(sampleRate * 0.006));
    this.reset();
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "push") { this.q.push(m.samples); this.avail += m.samples.length; }
      else if (m.type === "end") { this.draining = true; }
      else if (m.type === "clear") { this.reset(); }
    };
  }
  reset() {
    this.q = []; this.cur = null; this.idx = 0; this.avail = 0;
    this.a = 0; this.b = 0; this.t = 0;
    this.buffering = true; this.draining = false;
    this.rampIn = 0; this.last = 0;
  }
  read() {
    while (!this.cur || this.idx >= this.cur.length) {
      this.cur = this.q.shift(); this.idx = 0;
      if (!this.cur) return null;
    }
    this.avail--;
    return this.cur[this.idx++];
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    let i = 0;
    while (i < out.length) {
      if (this.buffering) {
        if (this.draining && this.avail === 0) {
          // Everything already played before "end" arrived.
          this.draining = false;
          this.port.postMessage({ type: "drained" });
        }
        if (this.avail >= this.prebuffer || (this.draining && this.avail > 0)) {
          const a = this.read(); const b = this.read();
          this.a = a ?? 0; this.b = b ?? this.a; this.t = 0;
          this.buffering = false; this.rampIn = this.rampLen;
        } else {
          // Silence, ramping the last value down so a stall never clicks.
          for (; i < out.length; i++) { this.last *= 0.97; out[i] = this.last; }
          break;
        }
      }
      let v = this.a + (this.b - this.a) * this.t;
      if (this.rampIn > 0) { v *= 1 - this.rampIn / this.rampLen; this.rampIn--; }
      out[i++] = v;
      this.last = v;
      this.t += this.step;
      while (this.t >= 1) {
        this.t -= 1;
        const n = this.read();
        if (n === null) {
          if (this.draining && this.avail === 0) this.port.postMessage({ type: "drained" });
          this.buffering = true; this.draining = false;
          break;
        }
        this.a = this.b; this.b = n;
      }
    }
    return true;
  }
}
registerProcessor("pcm-stream", PcmStream);
`;

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;
let moduleReady: Promise<void> | null = null;
const live = new Set<PcmTimeline>();

/**
 * Returns the shared AudioContext, creating or resuming it. Call this during a tap:
 * browsers only let audio start after the user has interacted with the page.
 */
export function primeAudio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    // Native device rate (no forced rate to fall back from) and roomier buffers, which
    // phones need to avoid dropouts while the page is busy rendering streamed text.
    ctx = new AudioContext({ latencyHint: "playback" });
    // Measured TTS audio swings almost full scale between adjacent samples on hissy
    // consonants; small phone speakers render that as crackle. Trim the top end (it adds
    // nothing to intelligibility) and catch peaks before they reach the speaker.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 7500;
    lowpass.Q.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    lowpass.connect(comp).connect(gain).connect(ctx.destination);
    input = lowpass;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    moduleReady = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    // Phones can suspend audio while waiting (for example after the microphone took the audio
    // focus) and only allow resuming on a tap. Any tap in the app resumes it, and audio that
    // was already queued then plays from where it waited.
    const unlock = () => resumeAudio();
    for (const type of ["pointerdown", "touchend", "keydown"]) {
      document.addEventListener(type, unlock, { capture: true, passive: true });
    }
  }
  resumeAudio();
  return ctx;
}

/** Resumes the audio context if the phone paused it. Works best when called from a tap. */
export function resumeAudio(): void {
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
}

/** True when the audio context is actually producing sound. */
export function audioRunning(): boolean {
  return ctx?.state === "running";
}

/** Stops everything that is playing or queued. */
export function stopPcm(): void {
  for (const t of live) t.close();
  live.clear();
}

/** Converts PCM bytes to Float32 samples. `bytes` must have an even length. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

// Audio queued before playback starts, so a slow chunk does not cause a stall.
const PREBUFFER_SECONDS = 0.25;

/**
 * One continuous playback stream. Append clips in order (sentences, or Live chunks); they
 * play back to back with no seams.
 */
export class PcmTimeline {
  private node: AudioWorkletNode | null = null;
  private backlog: Float32Array<ArrayBuffer>[] = [];
  private pushed = 0;
  private ended = false;
  private closed = false;
  private doneCallbacks: (() => void)[] = [];
  private readonly audio: AudioContext;

  constructor(
    private readonly rate: number,
    private readonly isStale: () => boolean,
    /** Called when audio is queued but the phone keeps the audio context paused. */
    private readonly onBlocked?: () => void,
  ) {
    const audio = primeAudio();
    if (!audio || !input || !moduleReady) throw new Error("Web Audio unavailable");
    if (!("AudioWorkletNode" in window)) throw new Error("AudioWorklet unavailable");
    this.audio = audio;
    live.add(this);
    const out = input;
    moduleReady
      .then(() => {
        if (this.closed) return;
        const node = new AudioWorkletNode(audio, "pcm-stream", {
          numberOfInputs: 0,
          outputChannelCount: [1],
          processorOptions: { inRate: this.rate, prebufferSeconds: PREBUFFER_SECONDS },
        });
        node.port.onmessage = (e) => {
          if (e.data?.type === "drained") this.fireDone();
        };
        node.connect(out);
        this.node = node;
        for (const s of this.backlog) this.post(s);
        this.backlog = [];
        if (this.ended) node.port.postMessage({ type: "end" });
      })
      .catch(() => this.close());
  }

  get hasAudio(): boolean {
    return this.pushed > 0;
  }

  private post(samples: Float32Array<ArrayBuffer>) {
    this.node?.port.postMessage({ type: "push", samples }, [samples.buffer]);
  }

  // Gemini Live audio carries occasional one-sample spikes; strip them before playback.
  private readonly declicker = new Declicker();

  private push(raw: Float32Array<ArrayBuffer>, flush = false) {
    if (this.closed || this.isStale()) return;
    const samples = this.declicker.process(raw, flush).out;
    if (samples.length === 0) return;
    if (this.pushed === 0) {
      // Try to resume (allowed if the user has tapped recently), then check it worked.
      resumeAudio();
      setTimeout(() => {
        if (!this.closed && !this.isStale() && this.audio.state !== "running") this.onBlocked?.();
      }, 500);
    }
    this.pushed += samples.length;
    // New audio after a finished turn (Live) starts a new segment to wait for.
    this.ended = false;
    if (this.node) this.post(samples);
    else this.backlog.push(samples);
  }

  /** Plays already-downloaded PCM (a cached answer, or one Live chunk). */
  appendPcm(bytes: Uint8Array) {
    const even = bytes.length % 2 ? bytes.subarray(0, bytes.length - 1) : bytes;
    if (even.length) this.push(pcm16ToFloat(even));
  }

  /** Streams a clip into the timeline and returns its PCM once fully downloaded. */
  async appendStream(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = body.getReader();
    const parts: Uint8Array[] = [];
    let carry: Uint8Array | null = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (this.isStale() || this.closed) {
          await reader.cancel();
          return new Uint8Array();
        }
        if (done) break;
        if (!value?.length) continue;
        parts.push(value);
        // Samples are 2 bytes; a chunk can end half-way through one.
        let bytes = value;
        if (carry) {
          const joined = new Uint8Array(carry.length + bytes.length);
          joined.set(carry);
          joined.set(bytes, carry.length);
          bytes = joined;
          carry = null;
        }
        if (bytes.length % 2) {
          carry = bytes.slice(-1);
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        this.push(pcm16ToFloat(bytes));
      }
    } catch {
      // Network dropped mid-clip: keep what arrived.
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const all = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      all.set(p, o);
      o += p.length;
    }
    return all;
  }

  /** Calls `onEnd` once everything appended so far has finished playing. */
  whenDone(onEnd: () => void) {
    // Release the few milliseconds the de-clicker holds back for look-ahead.
    this.push(new Float32Array(0), true);
    if (this.closed || this.pushed === 0) {
      onEnd();
      return;
    }
    this.doneCallbacks.push(onEnd);
    this.ended = true;
    this.node?.port.postMessage({ type: "end" });
  }

  private fireDone() {
    const cbs = this.doneCallbacks;
    this.doneCallbacks = [];
    for (const cb of cbs) cb();
  }

  /** Stops this stream immediately and releases it. */
  close() {
    if (this.closed) return;
    this.closed = true;
    live.delete(this);
    this.node?.port.postMessage({ type: "clear" });
    this.node?.disconnect();
    this.node = null;
    this.backlog = [];
    this.fireDone();
  }
}
