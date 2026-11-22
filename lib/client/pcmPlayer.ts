"use client";

// Plays a stream of 16-bit little-endian mono PCM as it downloads, using Web Audio.

/** Rate of the TTS stream; the audio context runs at the same rate (see primeAudio). */
export const STREAM_RATE = 24000;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let active: AudioBufferSourceNode[] = [];

/**
 * Returns the shared AudioContext, creating or resuming it. Call this during a tap:
 * browsers only let audio start after the user has interacted with the page.
 *
 * The context runs at the stream's own rate. With the default 48 kHz context, every block
 * was resampled separately and each seam clicked, which sounded like constant crackling.
 */
export function primeAudio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext({ sampleRate: STREAM_RATE });
    } catch {
      ctx = new AudioContext();
    }
    master = ctx.createGain();
    // A little headroom for small phone speakers.
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
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
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
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

// The first block waits a little longer so playback does not run dry while more downloads.
const FIRST_BLOCK_SECONDS = 0.5;
const BLOCK_SECONDS = 0.25;
const FADE_SECONDS = 0.008;

/**
 * Reads `body`, schedules each block to play right after the previous one, and returns all
 * PCM bytes once the download ends (playback may still be going). `onEnd` fires when the
 * last block finishes. Throws only if nothing at all could be played.
 */
export async function playPcmStream(
  body: ReadableStream<Uint8Array>,
  rate: number,
  isStale: () => boolean,
  onEnd: () => void,
): Promise<Uint8Array> {
  const audio = primeAudio();
  if (!audio || !master) throw new Error("Web Audio unavailable");
  const out = master;
  const fadeLen = Math.round(rate * FADE_SECONDS);

  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let carry: Uint8Array | null = null;
  let queued: Float32Array[] = [];
  let queuedLen = 0;
  let nextAt = 0;
  let scheduled = 0;
  let last: AudioBufferSourceNode | null = null;

  const flush = (final: boolean) => {
    if (queuedLen === 0) return;
    const samples = new Float32Array(queuedLen);
    let o = 0;
    for (const q of queued) {
      samples.set(q, o);
      o += q.length;
    }
    queued = [];
    queuedLen = 0;

    const earliest = audio.currentTime + 0.1;
    // A gap means playback ran dry (or this is the first block): fade in instead of popping.
    const gap = scheduled === 0 || earliest > nextAt + 0.002;
    if (gap) fade(samples, fadeLen, "in");
    if (final) fade(samples, fadeLen, "out");

    const buf = audio.createBuffer(1, samples.length, rate);
    buf.copyToChannel(samples, 0);
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    // Back-to-back blocks start exactly where the previous one ends, sample for sample.
    const startAt = gap ? Math.max(earliest, nextAt) : nextAt;
    src.start(startAt);
    nextAt = startAt + buf.duration;
    active.push(src);
    last = src;
    scheduled++;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (isStale()) {
        await reader.cancel();
        stopPcm();
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
      const target = scheduled === 0 ? FIRST_BLOCK_SECONDS : BLOCK_SECONDS;
      if (queuedLen >= rate * target) flush(false);
    }
  } catch (err) {
    if (scheduled === 0 && queuedLen === 0) throw err;
    // Network dropped mid-way: play what arrived.
  }
  flush(true);
  if (scheduled === 0) throw new Error("no audio received");

  // A very short clip may already have finished before the download loop returned.
  if (audio.currentTime >= nextAt) onEnd();
  else if (last) (last as AudioBufferSourceNode).onended = () => onEnd();

  const total = parts.reduce((n, p) => n + p.length, 0);
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return all;
}
