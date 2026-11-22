"use client";

// Plays 16-bit little-endian mono PCM through Web Audio as it downloads. Several clips
// (one per sentence) can be appended to one timeline so they play back to back.

/** Rate of the TTS stream; the audio context runs at the same rate (see primeAudio). */
export const STREAM_RATE = 24000;

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;
let active: AudioBufferSourceNode[] = [];

/**
 * Returns the shared AudioContext, creating or resuming it. Call this during a tap:
 * browsers only let audio start after the user has interacted with the page.
 *
 * The context runs at the stream's own rate: at the default 48 kHz every block was
 * resampled separately and each seam clicked.
 */
export function primeAudio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext({ sampleRate: STREAM_RATE });
    } catch {
      ctx = new AudioContext();
    }
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

export function stopPcm(): void {
  for (const s of active) {
    try {
      s.stop();
    } catch {
      // Already stopped.
    }
  }
  active = [];
}

/** Converts PCM bytes to Float32 samples. `bytes` must have an even length. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** Ramps the first or last `n` samples so a block cannot start or stop with a jump (a pop). */
export function fade(samples: Float32Array, n: number, where: "in" | "out"): void {
  const len = Math.min(n, samples.length);
  for (let i = 0; i < len; i++) {
    const k = i / len;
    if (where === "in") samples[i] *= k;
    else samples[samples.length - 1 - i] *= k;
  }
}

// The first block waits a little so playback does not run dry while more downloads.
const FIRST_BLOCK_SECONDS = 0.35;
const BLOCK_SECONDS = 0.25;
const FADE_SECONDS = 0.008;
// Scheduling lead when (re)starting playback from silence.
const START_LEAD = 0.06;

/**
 * One continuous playback timeline. Append clips in order; each one starts exactly where
 * the previous ended, so sentences flow without gaps or seams.
 */
export class PcmTimeline {
  private nextAt = 0;
  private scheduled = 0;
  private last: AudioBufferSourceNode | null = null;
  private readonly audio: AudioContext;
  private readonly out: AudioNode;

  constructor(
    private readonly rate: number,
    private readonly isStale: () => boolean,
    /** Called when audio is queued but the phone keeps the audio context paused. */
    private readonly onBlocked?: () => void,
  ) {
    const audio = primeAudio();
    if (!audio || !input) throw new Error("Web Audio unavailable");
    this.audio = audio;
    this.out = input;
  }

  get hasAudio(): boolean {
    return this.scheduled > 0;
  }

  private play(samples: Float32Array<ArrayBuffer>) {
    if (this.scheduled === 0) {
      // Try to resume (allowed if the user has tapped recently), then check it worked.
      resumeAudio();
      setTimeout(() => {
        if (!this.isStale() && this.audio.state !== "running") this.onBlocked?.();
      }, 500);
    }
    const now = this.audio.currentTime;
    // Only a real underrun (the queue already ran out) counts as a gap. Treating "less than
    // 100 ms left" as a gap, as before, inserted tiny silences that sounded like crackle.
    const gap = this.scheduled === 0 || this.nextAt < now + 0.005;
    if (gap) fade(samples, Math.round(this.rate * FADE_SECONDS), "in");
    const buf = this.audio.createBuffer(1, samples.length, this.rate);
    buf.copyToChannel(samples, 0);
    const src = this.audio.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const startAt = gap ? now + START_LEAD : this.nextAt;
    src.start(startAt);
    this.nextAt = startAt + buf.duration;
    active.push(src);
    this.last = src;
    this.scheduled++;
  }

  /** Plays already-downloaded PCM (a cached answer). */
  appendPcm(bytes: Uint8Array) {
    const even = bytes.length % 2 ? bytes.subarray(0, bytes.length - 1) : bytes;
    if (even.length) this.play(pcm16ToFloat(even));
  }

  /** Streams a clip into the timeline and returns its PCM once fully downloaded. */
  async appendStream(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = body.getReader();
    const parts: Uint8Array[] = [];
    let carry: Uint8Array | null = null;
    let queued: Float32Array<ArrayBuffer>[] = [];
    let queuedLen = 0;
    const flush = () => {
      if (!queuedLen) return;
      const samples = new Float32Array(queuedLen);
      let o = 0;
      for (const q of queued) {
        samples.set(q, o);
        o += q.length;
      }
      queued = [];
      queuedLen = 0;
      this.play(samples);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (this.isStale()) {
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
        const f = pcm16ToFloat(bytes);
        queued.push(f);
        queuedLen += f.length;
        const target = this.scheduled === 0 ? FIRST_BLOCK_SECONDS : BLOCK_SECONDS;
        if (queuedLen >= this.rate * target) flush();
      }
    } catch {
      // Network dropped mid-clip: keep what arrived.
    }
    flush();

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
    if (!this.last || this.audio.currentTime >= this.nextAt) {
      onEnd();
      return;
    }
    this.last.onended = () => onEnd();
  }
}
