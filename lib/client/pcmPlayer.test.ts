import { describe, expect, it } from "vitest";
import { fade, pcm16ToFloat } from "./pcmPlayer";

describe("fade", () => {
  it("ramps the start up from silence", () => {
    const s = new Float32Array([1, 1, 1, 1, 1, 1]);
    fade(s, 4, "in");
    expect(Array.from(s)).toEqual([0, 0.25, 0.5, 0.75, 1, 1]);
  });

  it("ramps the end down to silence", () => {
    const s = new Float32Array([1, 1, 1, 1, 1, 1]);
    fade(s, 4, "out");
    expect(Array.from(s)).toEqual([1, 1, 0.75, 0.5, 0.25, 0]);
  });

  it("copes with blocks shorter than the fade", () => {
    const s = new Float32Array([1, 1]);
    fade(s, 10, "in");
    expect(Array.from(s)).toEqual([0, 0.5]);
  });
});

describe("pcm16ToFloat", () => {
  it("reads little-endian signed 16-bit samples", () => {
    // 0x0000 = 0, 0x7fff = max, 0x8000 = min, 0x4000 = half
    const bytes = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x00, 0x40]);
    const out = pcm16ToFloat(bytes);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(1, 3);
    expect(out[2]).toBe(-1);
    expect(out[3]).toBe(0.5);
  });

  it("respects the view offset of a subarray", () => {
    const backing = new Uint8Array([9, 0x00, 0x40]);
    expect(pcm16ToFloat(backing.subarray(1))[0]).toBe(0.5);
  });
});
