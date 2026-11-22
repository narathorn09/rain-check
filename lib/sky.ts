import type { Level } from "./types";

/** What the sky looks like, for display. Alerts still use the rain `Level`. */
export type Sky =
  | "sunny"
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "moderate"
  | "heavy"
  | "storm";

export const SKY_LABEL: Record<Sky, string> = {
  sunny: "แดดออก",
  clear: "ฟ้าโปร่ง",
  partly: "มีเมฆบางส่วน",
  cloudy: "มีเมฆมาก",
  fog: "มีหมอก",
  drizzle: "ฝนปรอยๆ",
  rain: "ฝนเล็กน้อย",
  moderate: "ฝนปานกลาง",
  heavy: "ฝนตกหนัก",
  storm: "พายุฝนฟ้าคะนอง",
};

/** Maps a WMO weather code (as returned by Open-Meteo) to a sky type. */
export function skyFromCode(code: number, isDay: boolean): Sky {
  if (code <= 1) return isDay ? "sunny" : "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 61 || code === 66 || code === 80) return "rain";
  if (code === 63 || code === 81) return "moderate";
  if (code === 65 || code === 67 || code === 82) return "heavy";
  if (code >= 95) return "storm";
  // Snow codes (71-77, 85-86) do not occur in Thailand; show them as plain cloud.
  return "cloudy";
}

export function levelOfSky(sky: Sky): Level {
  if (sky === "heavy" || sky === "storm") return "heavy";
  if (sky === "drizzle" || sky === "rain" || sky === "moderate") return "light";
  return "dry";
}

const RANK: Record<Level, number> = { dry: 0, light: 1, heavy: 2 };

/**
 * Makes the rain amount and the weather code agree, so a row never says "ฝนตกหนัก"
 * next to a sunny picture: the wetter of the two wins, and the picture follows it.
 */
export function reconcile(mmLevel: Level, sky: Sky): { level: Level; sky: Sky } {
  const codeLevel = levelOfSky(sky);
  const level = RANK[mmLevel] >= RANK[codeLevel] ? mmLevel : codeLevel;
  if (level === "dry") return { level, sky };
  if (codeLevel === "dry") return { level, sky: level === "heavy" ? "heavy" : "rain" };
  if (level === "heavy" && codeLevel !== "heavy") return { level, sky: "heavy" };
  return { level, sky };
}

/** Sky for a slot that predates weather codes (or test data): derived from the rain level. */
export function skyOf(slot: { level: Level; sky?: Sky }): Sky {
  if (slot.sky) return slot.sky;
  return slot.level === "heavy" ? "heavy" : slot.level === "light" ? "rain" : "sunny";
}

export const isRainy = (sky: Sky) => levelOfSky(sky) !== "dry";
