import { describe, expect, it } from "vitest";
import { isWav, pcmToWav, rateFromMime } from "./wav";

describe("pcmToWav", () => {
  it("writes a 44-byte RIFF header with the right sizes and rate", () => {
    const wav = pcmToWav(new Uint8Array(100), 24000);
    const v = new DataView(wav.buffer);
    expect(wav.length).toBe(144);
    expect(isWav(wav)).toBe(true);
    expect(v.getUint32(4, true)).toBe(136);
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint32(40, true)).toBe(100);
  });
});

describe("rateFromMime", () => {
  it("reads the rate parameter or falls back", () => {
    expect(rateFromMime("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(rateFromMime("audio/wav")).toBe(24000);
    expect(rateFromMime(undefined)).toBe(24000);
  });
});
