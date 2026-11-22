// Thailand has no daylight saving, so a fixed +7h offset is exact.
const OFFSET_MS = 7 * 60 * 60 * 1000;

export interface BangkokNow {
  date: string;
  hour: number;
  minute: number;
  minutesOfDay: number;
}

export function bangkokNow(at: Date = new Date()): BangkokNow {
  const shifted = new Date(at.getTime() + OFFSET_MS);
  const iso = shifted.toISOString();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return { date: iso.slice(0, 10), hour, minute, minutesOfDay: hour * 60 + minute };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Spoken Thai clock, e.g. 10 -> "10 โมงเช้า", 19 -> "1 ทุ่ม". Hour 24 means midnight. */
export function thaiHour(h: number): string {
  const x = h % 24;
  if (x === 0) return "เที่ยงคืน";
  if (x <= 5) return `ตี ${x}`;
  if (x <= 11) return `${x} โมงเช้า`;
  if (x === 12) return "เที่ยง";
  if (x === 13) return "บ่ายโมง";
  if (x <= 15) return `บ่าย ${x - 12} โมง`;
  if (x <= 18) return `${x - 12} โมงเย็น`;
  return `${x - 18} ทุ่ม`;
}

export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
