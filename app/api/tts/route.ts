import { ApiError, GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { isWav } from "@/lib/wav";

export const maxDuration = 30;

// Server-side speech, because many phones only have an English voice and skip Thai text.
// Lite first for speed and cost. Each model has its own quota, so the older preview models
// keep speech working after the 3.8 models hit their limit (429).
const MODELS = [
  process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts",
  ...(
    process.env.GEMINI_TTS_FALLBACK_MODELS ??
    "gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts,gemini-2.5-pro-preview-tts"
  )
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
].filter((m, i, all) => all.indexOf(m) === i);

// Pre-3.8 models take the style as part of the prompt and the voice as prebuiltVoiceConfig;
// they do not know speechMetadata or voiceConfig.voice.
const isLegacy = (model: string) => !/^gemini-3\.8-/.test(model);
// "Leda" is listed as youthful, which suits a "little sister" character; Kore sounded firm.
// Both voice and style can be changed in Vercel without a code change.
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Leda";
const STYLE =
  process.env.GEMINI_TTS_STYLE ??
  "A sweet, soft young woman's voice with a gentle smile in it; warm, friendly and caring, " +
    "like a cheerful young relative chatting with an older family member. " +
    "Natural conversational Thai with a gentle smile in the voice, relaxed pace, " +
    "clear pronunciation, soft polite endings. Not robotic, not like a news reader.";
const FALLBACK_STATUSES = new Set([404, 429, 500, 503, 504]);
// Caps audio length and cost; chat answers are far shorter.
const MAX_CHARS = 600;
// Streaming responses default to headerless 16-bit mono PCM at this rate.
const SAMPLE_RATE = 24000;

function pcmOf(chunk: GenerateContentResponse): Uint8Array | null {
  const part = chunk.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  const bytes = new Uint8Array(Buffer.from(part.inlineData.data, "base64"));
  // Strip a WAV header if one ever arrives, so the client only ever sees raw PCM.
  return isWav(bytes) ? bytes.subarray(44) : bytes;
}

/**
 * Streams raw PCM (audio/L16) as Gemini produces it, so the phone can start playing
 * after the first chunk instead of waiting for the whole clip.
 */
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
  const abortSignal = AbortSignal.timeout(28_000);

  // Pick a model by waiting for its first chunk: errors surface there, before any bytes
  // are sent, so a failing model can still fall back to the next one.
  let opened: { iterator: AsyncIterator<GenerateContentResponse>; first: GenerateContentResponse } | null = null;
  // Gemini's status for the last failure, returned so a phone can tell quota (429) from other errors.
  let upstream: number | undefined;
  for (const model of MODELS) {
    try {
      const legacy = isLegacy(model);
      const stream = await ai.models.generateContentStream({
        model,
        contents: [
          {
            role: "user",
            parts: legacy
              ? [{ text: `Read aloud in Thai. Voice style: ${STYLE}\n\n${text}` }]
              : [{ text, speechMetadata: { style: STYLE } }],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: legacy
            ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } }
            : { voiceConfig: { voice: VOICE } },
          abortSignal,
        },
      });
      const iterator = stream[Symbol.asyncIterator]();
      const first = await iterator.next();
      if (first.done) throw new Error("empty audio stream");
      opened = { iterator, first: first.value };
      break;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      console.warn(`tts: model ${model} failed`, status ?? err);
      // Keep the most telling status: a 429 from an earlier model explains more than a
      // legacy model rejecting the request shape.
      if (upstream !== 429) upstream = status;
      if (status === undefined) break;
      // A legacy model may reject the request outright (400/403/404); try the next one anyway.
      if (!FALLBACK_STATUSES.has(status) && !isLegacy(model)) break;
    }
  }
  if (!opened) return NextResponse.json({ error: "speech unavailable", upstream: upstream ?? null }, { status: 502 });

  const { iterator } = opened;
  let pending: GenerateContentResponse | null = opened.first;
  const audio = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const chunk = pending ?? (await iterator.next().then((r) => (r.done ? null : r.value)));
          pending = null;
          if (!chunk) {
            controller.close();
            return;
          }
          const pcm = pcmOf(chunk);
          if (pcm?.length) {
            controller.enqueue(pcm);
            return;
          }
        }
      } catch (err) {
        // Mid-stream failure: end cleanly so the phone plays what it already has.
        console.error("tts stream failed", err);
        controller.close();
      }
    },
    cancel() {
      iterator.return?.();
    },
  });

  return new Response(audio, {
    headers: {
      "Content-Type": `audio/L16; rate=${SAMPLE_RATE}; channels=1`,
      "Cache-Control": "no-store",
    },
  });
}
