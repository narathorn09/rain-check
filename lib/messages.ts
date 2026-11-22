import { DAY_HOURS, minutesToRain, slotsInWindow, summarize } from "./rain";
import { clock, type BangkokNow } from "./time";
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
