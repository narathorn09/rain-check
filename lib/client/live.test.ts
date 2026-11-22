import { describe, expect, it } from "vitest";
import { downsample, floatToPcm16Base64 } from "./live";

describe("floatToPcm16Base64", () => {
  it("encodes little-endian 16-bit samples and clamps out-of-range values", () => {
    const b64 = floatToPcm16Base64(new Float32Array([0, 1, -1, 2]));
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
    expect(view.getInt16(6, true)).toBe(32767);
  });
});

describe("downsample", () => {
  it("averages 48 kHz down to 16 kHz", () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000, 16000);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(1);
  });

  it("leaves audio already at the target rate untouched", () => {
    const s = new Float32Array([0.1, 0.2]);
    expect(downsample(s, 16000, 16000)).toBe(s);
  });
});
