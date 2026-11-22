import { describe, expect, it } from "vitest";
import { Limiter } from "./limiter";

function run(l: Limiter, input: Float32Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = l.process(input[i]);
  return out;
}

const RATE = 48000;

describe("Limiter", () => {
  it("passes quiet audio through at the set gain, delayed by the look-ahead", () => {
    const l = new Limiter(RATE, 2);
    const input = new Float32Array(1000).map((_, i) => 0.1 * Math.sin(i / 20));
    const out = run(l, input);
    const look = Math.round(RATE * 0.004);
    expect(out[500 + look]).toBeCloseTo(input[500] * 2, 5);
  });

  it("never exceeds the ceiling, even with sudden loud peaks", () => {
    const l = new Limiter(RATE, 4, 0.9);
    const input = new Float32Array(RATE).map((_, i) => (i % 5000 === 0 ? 1 : 0.3 * Math.sin(i / 7)));
    const out = run(l, input);
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.9 + 1e-6);
  });

  it("makes speech-like audio clearly louder while staying under the ceiling", () => {
    const l = new Limiter(RATE, 3, 0.9);
    // Quiet body with occasional loud bursts, like speech.
    const input = new Float32Array(RATE).map((_, i) => Math.sin(i / 9) * (i % 8000 < 400 ? 0.6 : 0.15));
    const out = run(l, input);
    const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    // The bursts are capped, so loudness rises by less than the gain, but still clearly.
    expect(rms(out)).toBeGreaterThan(rms(input) * 1.7);
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.9 + 1e-6);
  });
});
