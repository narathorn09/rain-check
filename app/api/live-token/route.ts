import { GoogleGenAI, Modality } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { assistantInstruction } from "@/lib/assistant";
import { cleanProfile } from "@/lib/profile";
import { bangkokNow } from "@/lib/time";
import { fetchForecast, validCoords } from "@/lib/weather";

export const maxDuration = 20;

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
// Same friendly voice as the read-aloud; Live accepts the TTS voices.
const LIVE_VOICE = process.env.GEMINI_LIVE_VOICE ?? process.env.GEMINI_TTS_VOICE ?? "Leda";
// Long enough for a chat about the weather, short enough to bound cost if left open.
const CALL_MINUTES = 10;

/**
 * Issues a short-lived, single-use token for a voice call with น้องฝน. The phone connects
 * straight to Gemini Live with it (Vercel functions cannot hold a WebSocket open), so the
 * real API key never leaves the server. The token is locked to our model and instructions,
 * which already include this place's forecast, so a leaked token cannot be repurposed.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "assistant not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    place?: { name?: string; lat?: number; lon?: number };
    profile?: { callName?: unknown; routine?: unknown };
  } | null;
  const lat = Number(body?.place?.lat);
  const lon = Number(body?.place?.lon);
  if (!validCoords(lat, lon)) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  try {
    const now = bangkokNow();
    const forecast = await fetchForecast(lat, lon);
    const systemInstruction = assistantInstruction({
      mode: "voice",
      profile: cleanProfile(body?.profile),
      placeName: String(body?.place?.name ?? "ตำแหน่งของผู้ใช้"),
      forecast,
      now,
    });

    // Tokens are a v1beta feature; the SDK otherwise defaults to v1.
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta", timeout: 12_000 } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + CALL_MINUTES * 60_000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE } } },
            // Transcripts let the chat show what was said on both sides.
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    });
    if (!token.name) throw new Error("no token returned");
    return NextResponse.json({ token: token.name, model: LIVE_MODEL, minutes: CALL_MINUTES });
  } catch (err) {
    console.error("live-token failed", err);
    return NextResponse.json({ error: "voice call unavailable" }, { status: 502 });
  }
}
