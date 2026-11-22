import { ApiError, GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { isWav, pcmToWav, rateFromMime } from "@/lib/wav";

export const maxDuration = 30;

// Server-side speech, because many phones only have an English voice and skip Thai text.
// Lite first for speed and cost; the full model is the fallback.
const MODELS = [
  process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts",
  ...(process.env.GEMINI_TTS_FALLBACK_MODELS ?? "gemini-3.8-flash-tts")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
].filter((m, i, all) => all.indexOf(m) === i);
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
const FALLBACK_STATUSES = new Set([404, 429, 500, 503, 504]);
// Caps audio size (~1 MB per 20 s of speech) and cost; chat answers are far shorter.
const MAX_CHARS = 600;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "speech not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      // The SDK defaults to the v1 API, which rejects speechConfig and speechMetadata
      // ("Cannot find field"); speech generation lives in v1beta.
      apiVersion: "v1beta",
      // Gemini rejects deadlines under 10s; one attempt per model, then the next model.
      timeout: 12_000,
      retryOptions: { attempts: 1 },
    },
  });
  const abortSignal = AbortSignal.timeout(25_000);

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text, speechMetadata: { style: "อบอุ่น เป็นกันเอง พูดช้าและชัด สำหรับผู้สูงอายุ" } }],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { voice: VOICE } },
          abortSignal,
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no audio in response");

      const raw = new Uint8Array(Buffer.from(part.inlineData.data, "base64"));
      // Unary responses are documented as WAV already; wrap raw PCM just in case.
      const wav = isWav(raw) ? raw : pcmToWav(raw, rateFromMime(part.inlineData.mimeType));
      return new NextResponse(Buffer.from(wav), {
        headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" },
      });
    } catch (err) {
      lastError = err;
      const status = err instanceof ApiError ? err.status : undefined;
      console.warn(`tts: model ${model} failed`, status ?? err);
      if (status === undefined || !FALLBACK_STATUSES.has(status)) break;
    }
  }
  console.error("tts failed", lastError);
  return NextResponse.json({ error: "speech unavailable" }, { status: 502 });
}
