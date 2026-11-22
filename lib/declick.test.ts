import { describe, expect, it } from "vitest";
import { Declicker } from "./declick";

const RATE = 24000;

/** Speech-like test tone: a 300 Hz voice with a slow loudness wobble. */
function voice(seconds: number): Float32Array {
  const n = Math.round(RATE * seconds);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    x[i] = 0.6 * Math.sin(2 * Math.PI * 300 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
  }
  return x;
}

/** Runs a whole signal through in uneven chunks, as a stream would arrive. */
function stream(x: Float32Array, sizes = [960, 4320, 1920, 7680, 2400]) {
  const d = new Declicker();
  const parts: Float32Array[] = [];
  let fixed = 0;
  let o = 0;
  let k = 0;
  while (o < x.length) {
    const n = sizes[k++ % sizes.length];
    const r = d.process(x.subarray(o, o + n), o + n >= x.length);
    parts.push(r.out);
    fixed += r.fixed;
    o += n;
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return { out, fixed };
}

describe("Declicker", () => {
  it("passes clean speech through unchanged, sample for sample", () => {
    const x = voice(1);
    const { out, fixed } = stream(x);
    expect(fixed).toBe(0);
    expect(out.length).toBe(x.length);
    expect(Array.from(out)).toEqual(Array.from(x));
  });

  it("removes isolated spikes, including one on a chunk boundary", () => {
    const x = voice(1);
    const clean = x.slice();
    for (const at of [3000, 960 + 4320, 15000]) x[at] += 0.7;
    const { out, fixed } = stream(x);
    expect(fixed).toBe(3);
    expect(out.length).toBe(x.length);
    let worst = 0;
    for (let i = 0; i < out.length; i++) worst = Math.max(worst, Math.abs(out[i] - clean[i]));
    // Repaired samples land close to the true waveform.
    expect(worst).toBeLessThan(0.05);
  });

  it("leaves a loud, sudden but genuine onset alone", () => {
    const x = new Float32Array(RATE / 2);
    for (let i = 6000; i < x.length; i++) x[i] = 0.8 * Math.sin(2 * Math.PI * 300 * (i / RATE));
    const { fixed } = stream(x);
    expect(fixed).toBe(0);
  });
});
