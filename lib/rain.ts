import { SKY_LABEL, skyOf, type Sky } from "./sky";
import type { Forecast, HourRange, Level, Minutely, Slot } from "./types";
import { thaiHour, type BangkokNow } from "./time";

export const LEVEL_LABEL: Record<Level, string> = {
  dry: "อากาศดี",
  light: "ฝนเบา",
  heavy: "ฝนตกหนัก",
};

/** Hours of the day that summaries and alerts cover; overnight rain is not worth a message. */
export const DAY_HOURS: HourRange = { start: 5, end: 21 };

const RAIN_MM = 0.1;
const HEAVY_MM_PER_HOUR = 2.5;
// Probability alone is a weak signal, so it only upgrades a dry hour at a high value.
const LIKELY_PROB = 70;

export function classify(mm: number, prob: number): Level {
  if (mm >= HEAVY_MM_PER_HOUR) return "heavy";
  if (mm >= RAIN_MM || prob >= LIKELY_PROB) return "light";
  return "dry";
}

export interface Range {
  start: number;
  end: number;
  level: Level;
}

/** Merge consecutive hours of the same level into ranges. `end` is exclusive. */
export function mergeRanges(slots: Slot[]): Range[] {
  const out: Range[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.level === s.level && last.end === s.hour) {
      last.end = s.hour + 1;
    } else {
      out.push({ start: s.hour, end: s.hour + 1, level: s.level });
    }
  }
  return out;
}

export function rangeText(r: { start: number; end: number }): string {
  return `${thaiHour(r.start)} ถึง ${thaiHour(r.end)}`;
}

export interface Summary {
  kind: "dry" | "rain";
  text: string;
  rainRanges: Range[];
}

/** Slots of one day that fall inside [start, end) and are not already in the past. */
export function slotsInWindow(
  slots: Slot[],
  now: BangkokNow,
  win: HourRange = DAY_HOURS,
  date: string = now.date,
): Slot[] {
  return slots.filter(
    (s) =>
      s.date === date &&
      s.hour >= win.start &&
      s.hour < win.end &&
      (date !== now.date || s.hour >= now.hour),
  );
}

export function summarize(slots: Slot[], scope: string): Summary {
  if (slots.length === 0) {
    return { kind: "dry", text: `${scope} ไม่มีข้อมูลพยากรณ์`, rainRanges: [] };
  }
  const rainRanges = mergeRanges(slots).filter((r) => r.level !== "dry");
  if (rainRanges.length === 0) {
    return { kind: "dry", text: `${scope} ฝนไม่ตก`, rainRanges };
  }
  const parts = rainRanges.map((r) =>
    r.level === "heavy" ? `${rangeText(r)} (ตกหนัก)` : rangeText(r),
  );
  return { kind: "rain", text: `${scope} ฝนตก ${parts.join(" และ ")}`, rainRanges };
}

/**
 * Minutes until the next 15-minute step with rain, or 0 if it is raining now.
 * Returns null when no rain shows up in the data.
 */
export function minutesToRain(minutely: Minutely[], now: BangkokNow): number | null {
  const nowTotal = now.minutesOfDay;
  for (const m of minutely) {
    if (m.date !== now.date) continue;
    const start = m.hour * 60 + m.minute;
    // Each step covers [start, start + 15).
    if (start + 15 <= nowTotal) continue;
    if (m.mm >= 0.05) return Math.max(0, start - nowTotal);
  }
  return null;
}

export interface SkyRange {
  start: number;
  end: number;
  sky: Sky;
  level: Level;
}

/** Merge consecutive hours that look the same into display ranges. `end` is exclusive. */
export function mergeBySky(slots: Slot[]): SkyRange[] {
  const out: SkyRange[] = [];
  for (const s of slots) {
    const sky = skyOf(s);
    const last = out[out.length - 1];
    if (last && last.sky === sky && last.end === s.hour) {
      last.end = s.hour + 1;
    } else {
      out.push({ start: s.hour, end: s.hour + 1, sky, level: s.level });
    }
  }
  return out;
}

/** Plain-text forecast block that the chat model uses as its only source of truth. */
export function forecastForPrompt(f: Forecast, now: BangkokNow): string {
  const lines: string[] = [];
  for (const s of f.slots) {
    if (s.date < now.date) continue;
    if (s.date === now.date && s.hour < now.hour) continue;
    const day = s.date === now.date ? "วันนี้" : "พรุ่งนี้";
    lines.push(
      `${day} ${String(s.hour).padStart(2, "0")}:00 (${thaiHour(s.hour)}): ${SKY_LABEL[skyOf(s)]} (${LEVEL_LABEL[s.level]}), ฝน ${s.mm.toFixed(1)} มม., โอกาสฝน ${s.prob}%`,
    );
  }
  const currentLine = f.current
    ? `ตอนนี้: ${SKY_LABEL[f.current.sky]}, อุณหภูมิ ${Math.round(f.current.temp)} องศา\n`
    : "";
  return currentLine + lines.join("\n");
}
