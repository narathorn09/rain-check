import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { forecastForPrompt } from "@/lib/rain";
import { bangkokNow, clock, thaiHour } from "@/lib/time";
import { fetchForecast, validCoords } from "@/lib/weather";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 22_000;
const MAX_TURNS = 10;
const MAX_CHARS = 500;

const PERSONA = `คุณคือ "น้องฝน" ผู้ช่วยเรื่องฝนและอากาศในแอป "เช็คฝน" ผู้ใช้หลักคือคุณแม่สูงอายุที่ขายของกลางแจ้ง

กติกา:
- ตอบเป็นภาษาไทย สุภาพ อบอุ่นแบบลูกหลาน ลงท้ายด้วย "ค่ะ"
- เริ่มด้วยคำตอบตรงๆ ก่อน แล้วค่อยเสริมคำแนะนำสั้นๆ รวมไม่เกิน 3 ประโยค
- ใช้เวลาแบบพูดทั่วไป เช่น "10 โมงเช้า" "บ่าย 2 โมง" ห้ามใช้ศัพท์เทคนิคหรือตัวเลข mm/เปอร์เซ็นต์ เว้นแต่ถูกถามโดยตรง
- ตอบจากข้อมูลพยากรณ์ด้านล่างเท่านั้น ห้ามเดาหรือแต่งตัวเลขเอง ถ้าข้อมูลไม่พอหรือไม่แน่ใจ ให้บอกตรงๆ ว่าไม่แน่ใจ
- พยากรณ์ฝนคลาดเคลื่อนได้ ถ้าเป็นเรื่องสำคัญให้แนะนำพกร่มหรือผ้าคลุมไว้ก่อน
- ช่วยได้เฉพาะเรื่องฝน อากาศ และการวางแผนขายของตามสภาพอากาศ ถ้าถามเรื่องอื่นให้ปฏิเสธสุภาพสั้นๆ และชวนถามเรื่องฝน
- ไม่ใช้ markdown ไม่ใช้อีโมจิ ไม่ใช้รายการหัวข้อ`;

interface Turn {
  role: "user" | "model";
  text: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "assistant not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    messages?: Turn[];
    place?: { name?: string; lat?: number; lon?: number };
    window?: { start?: number; end?: number };
  } | null;

  const lat = Number(body?.place?.lat);
  const lon = Number(body?.place?.lon);
  const turns = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_CHARS) }] }));
  if (!validCoords(lat, lon) || turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  try {
    const now = bangkokNow();
    const forecast = await fetchForecast(lat, lon);
    const start = Number(body?.window?.start);
    const end = Number(body?.window?.end);
    const sellLine =
      Number.isFinite(start) && Number.isFinite(end)
        ? `ช่วงเวลาขายของของผู้ใช้: ${thaiHour(start)} ถึง ${thaiHour(end)}`
        : "ผู้ใช้ยังไม่ได้ตั้งช่วงเวลาขายของ";

    const system = `${PERSONA}

ข้อมูลตอนนี้:
- เวลาตอนนี้ (ไทย): ${clock(now.minutesOfDay)} น. (${thaiHour(now.hour)})
- สถานที่: ${String(body?.place?.name ?? "ตำแหน่งของผู้ใช้").slice(0, 60)}
- ${sellLine}

พยากรณ์รายชั่วโมงตั้งแต่ตอนนี้ (ระดับ: แล้ง = ไม่มีฝน, ฝนเบา, ฝนตกหนัก):
${forecastForPrompt(forecast, now)}`;

    // The SDK retries up to 5 times with backoff by default, which can outlast maxDuration.
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 2 } },
    });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: turns,
      config: {
        systemInstruction: system,
        temperature: 0.4,
        maxOutputTokens: 400,
        // Hard cap below maxDuration so the user gets a clear error, not a platform 504.
        abortSignal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
      },
    });
    const text = res.text?.trim();
    if (!text) return NextResponse.json({ error: "empty answer" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (err) {
    console.error("chat failed", err);
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      { error: timedOut ? "assistant timed out" : "assistant unavailable" },
      { status: timedOut ? 504 : 502 },
    );
  }
}
