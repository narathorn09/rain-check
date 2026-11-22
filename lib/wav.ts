/** Wraps headerless 16-bit little-endian mono PCM in a WAV (RIFF) container so browsers can play it. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  const bytesPerSample = 2;
  write(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  v.setUint16(32, bytesPerSample, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  write(36, "data");
  v.setUint32(40, pcm.length, true);

  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

export function isWav(bytes: Uint8Array): boolean {
  return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF";
}

/** Reads the sample rate from a mime type such as "audio/L16;codec=pcm;rate=24000". */
export function rateFromMime(mime: string | undefined, fallback = 24000): number {
  const m = mime?.match(/rate=(\d+)/i);
  return m ? Number(m[1]) : fallback;
}
