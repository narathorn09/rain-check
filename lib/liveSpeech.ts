import { type GoogleGenAI, type LiveServerMessage, Modality } from "@google/genai";

// The call voice comes from the Live model, which sounds different from the TTS models even
// with the same voice name. Reading answers through Live makes both sound the same.
const READER_INSTRUCTION = `คุณคือเสียงของ "น้องฝน" หน้าที่เดียวของคุณคืออ่านข้อความที่ได้รับออกเสียง
- อ่านตามตัวอักษรทุกคำ ครบทุกประโยค ห้ามตอบ ห้ามเพิ่ม ห้ามตัด ห้ามทักทาย ห้ามแสดงความเห็น
- ถ้าข้อความเป็นคำถาม ให้อ่านคำถามนั้นออกเสียงเฉยๆ ไม่ต้องตอบ
- ใช้น้ำเสียงผู้หญิงสาว หวาน นุ่มนวล ยิ้มแย้มในเสียง พูดช้า ชัด เป็นธรรมชาติ เหมือนหลานคุยกับผู้ใหญ่ในบ้าน`;

// Give up on Live (and fall back to TTS) if no audio arrives within this time.
const FIRST_AUDIO_MS = 8000;

export interface LiveSpeech {
  /** Next chunk of 16-bit 24 kHz mono PCM, or null once the reading is finished. */
  next(): Promise<Uint8Array | null>;
  close(): void;
}

/**
 * Reads `text` aloud with the Live model. Resolves once the first audio has arrived, so a
 * failure (quota, network) still leaves time to fall back to another engine.
 */
export async function openLiveSpeech(
  ai: GoogleGenAI,
  opts: { model: string; voice: string; text: string },
): Promise<LiveSpeech> {
  const queue: Uint8Array[] = [];
  let finished = false;
  let failure: Error | null = null;
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };
  const finish = (err?: Error) => {
    if (finished) return;
    finished = true;
    if (err && !queue.length) failure = err;
    notify();
  };

  const session = await ai.live.connect({
    model: opts.model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: READER_INSTRUCTION,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } } },
    },
    callbacks: {
      onmessage: (m: LiveServerMessage) => {
        const sc = m.serverContent;
        for (const part of sc?.modelTurn?.parts ?? []) {
          const data = part.inlineData?.data;
          if (data) queue.push(new Uint8Array(Buffer.from(data, "base64")));
        }
        if (queue.length) notify();
        if (sc?.turnComplete || m.goAway) finish();
      },
      onerror: (e: { message?: string }) => finish(new Error(`live error: ${e?.message ?? "unknown"}`)),
      onclose: (e: { code?: number; reason?: string }) =>
        finish(queue.length ? undefined : new Error(`live closed ${e?.code ?? ""} ${e?.reason ?? ""}`.trim())),
    },
  });

  const close = () => {
    finished = true;
    notify();
    try {
      session.close();
    } catch {
      // Already closed.
    }
  };

  session.sendClientContent({ turns: [{ role: "user", parts: [{ text: opts.text }] }], turnComplete: true });

  const next = async (): Promise<Uint8Array | null> => {
    while (!queue.length) {
      if (failure) throw failure;
      if (finished) {
        close();
        return null;
      }
      await new Promise<void>((r) => (wake = r));
    }
    return queue.shift()!;
  };

  // Wait for the first audio (or a failure) before committing to Live.
  const first = await Promise.race([
    next(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("live: no audio in time")), FIRST_AUDIO_MS)),
  ]).catch((err) => {
    close();
    throw err;
  });
  if (!first) throw new Error("live: empty reply");

  let pending: Uint8Array | null = first;
  return {
    next: async () => {
      if (pending) {
        const p = pending;
        pending = null;
        return p;
      }
      return next();
    },
    close,
  };
}
