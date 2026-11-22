"use client";

// Plays a stream of 16-bit little-endian mono PCM as it downloads, using Web Audio.

let ctx: AudioContext | null = null;
let active: AudioBufferSourceNode[] = [];

/**
 * Returns the shared AudioContext, creating or resuming it. Call this during a tap:
 * browsers only let audio start after the user has interacted with the page.
 */
export function primeAudio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
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

// Small blocks start sound sooner; too small and scheduling gaps become audible.
const MIN_BLOCK_SECONDS = 0.25;

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
  if (!audio) throw new Error("Web Audio unavailable");

  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let carry: Uint8Array | null = null;
  let queued: Float32Array[] = [];
  let queuedLen = 0;
  let nextAt = 0;
  let scheduled = 0;
  let last: AudioBufferSourceNode | null = null;

  const flush = () => {
    if (queuedLen === 0) return;
    const samples = new Float32Array(queuedLen);
    let o = 0;
    for (const q of queued) {
      samples.set(q, o);
      o += q.length;
    }
    queued = [];
    queuedLen = 0;
    // The context resamples 24 kHz buffers to its own rate automatically.
    const buf = audio.createBuffer(1, samples.length, rate);
    buf.copyToChannel(samples, 0);
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    const startAt = Math.max(audio.currentTime + 0.05, nextAt);
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
      if (queuedLen >= rate * MIN_BLOCK_SECONDS) flush();
    }
  } catch (err) {
    if (scheduled === 0 && queuedLen === 0) throw err;
    // Network dropped mid-way: play what arrived.
  }
  flush();
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
