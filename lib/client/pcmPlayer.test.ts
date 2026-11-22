import { describe, expect, it } from "vitest";
import { pcm16ToFloat } from "./pcmPlayer";

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
