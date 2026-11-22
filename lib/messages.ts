import { DAY_HOURS, minutesToRain, slotsInWindow, summarize } from "./rain";
import { addDays, clock, thaiHour, type BangkokNow } from "./time";
import type { Forecast, Place } from "./types";

// Fixed templates keep alerts predictable and free; only the chat tab uses the model.

export function morningMessage(f: Forecast, now: BangkokNow, place: Place) {
  const slots = slotsInWindow(f.slots, { ...now, hour: 0 });
  const s = summarize(slots, `วันนี้ที่${place.name}`);
  const tail = s.kind === "dry" ? "ออกไปทำธุระได้สบายค่ะ" : "อย่าลืมพกร่มด้วยนะคะ";
  return { title: "เช็คฝน: สรุปเช้านี้", body: `${s.text} ${tail}`, tag: "morning" };
}

/** Returns null when no alert is warranted right now. */
export function alertMessage(f: Forecast, now: BangkokNow, place: Place) {
  if (now.hour < DAY_HOURS.start || now.hour >= DAY_HOURS.end) return null;
  const m = minutesToRain(f.minutely, now);
  // Already raining: the user can see that for themselves.
  if (m === null || m === 0 || m > 30) return null;
  const rounded = Math.max(5, Math.round(m / 5) * 5);
  return {
    title: "เช็คฝน: ฝนใกล้ตก",
    body: `อีกประมาณ ${rounded} นาทีฝนจะตกที่${place.name} เก็บของหรือหาที่หลบได้เลยค่ะ`,
    tag: "alert",
  };
}

/** How far ahead the hourly forecast is trusted enough to warn about. */
export const ADVANCE_HOURS = 3;
/** An early warning must give at least this much notice; closer rain gets the 30-minute alert. */
export const MIN_ADVANCE_MIN = 60;

/**
 * Early warning from the hourly forecast: rain starts in MIN_ADVANCE_MIN..ADVANCE_HOURS.
 * `key` identifies the rain spell so the cron sends one warning per spell.
 * Returns null when it is raining now or no rain is coming in that range.
 */
export function advanceMessage(f: Forecast, now: BangkokNow, place: Place) {
  if (now.hour < DAY_HOURS.start || now.hour >= DAY_HOURS.end) return null;
  if (minutesToRain(f.minutely, now) === 0) return null;

  const tomorrow = addDays(now.date, 1);
  const startOf = (date: string, hour: number) => hour * 60 + (date === tomorrow ? 24 * 60 : 0);
  const next = f.slots.find((s) => {
    if (s.level === "dry" || (s.date !== now.date && s.date !== tomorrow)) return false;
    const ahead = startOf(s.date, s.hour) - now.minutesOfDay;
    return ahead > 0 && ahead <= ADVANCE_HOURS * 60;
  });
  if (!next) return null;

  const ahead = startOf(next.date, next.hour) - now.minutesOfDay;
  if (ahead < MIN_ADVANCE_MIN) return null;
  // Round down so the message never promises more time than there is.
  const hours = Math.floor(ahead / 60);
  const kind = next.sky === "storm" ? "จะมีพายุฝนฟ้าคะนอง" : next.level === "heavy" ? "ฝนตกหนัก" : "ฝนจะตก";
  return {
    key: `${next.date}T${String(next.hour).padStart(2, "0")}`,
    title: "เช็คฝน: เตือนล่วงหน้า",
    body: `อีกประมาณ ${hours} ชั่วโมง${kind}ที่${place.name} (ราว${thaiHour(next.hour)}) เตรียมร่มไว้นะคะ`,
    tag: "advance",
  };
}

export function testMessage() {
  return {
    title: "เช็คฝน",
    body: `ทดสอบแจ้งเตือนสำเร็จ (${clock(bangkokMinutes())}) ค่ะ`,
    tag: "test",
  };
}

function bangkokMinutes(): number {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
