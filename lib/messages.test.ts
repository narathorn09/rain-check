import { describe, expect, it } from "vitest";
import { advanceMessage, alertMessage, morningMessage } from "./messages";
import { classify } from "./rain";
import { bangkokNow } from "./time";
import type { Forecast, Slot } from "./types";

const place = { name: "ตลาดสด", lat: 13.7, lon: 100.5 };
const DATE = "2026-11-22";

const slot = (hour: number, mm: number): Slot => ({ date: DATE, hour, mm, prob: 0, level: classify(mm, 0) });
const forecast = (rainHours: number[]): Forecast => ({
  slots: Array.from({ length: 24 }, (_, h) => slot(h, rainHours.includes(h) ? 1 : 0)),
  minutely: [],
});

describe("morningMessage", () => {
  const at = bangkokNow(new Date("2026-11-21T22:30:00Z")); // 05:30 Bangkok on the 22nd

  it("says it is dry when no rain falls during the day", () => {
    const m = morningMessage(forecast([]), at, place);
    expect(m.body).toContain("ฝนไม่ตก");
    expect(m.body).toContain("ตลาดสด");
  });

  it("greets by name when one is set", () => {
    expect(morningMessage(forecast([]), at, place, "คุณยาย").body.startsWith("อรุณสวัสดิ์ค่ะคุณยาย")).toBe(true);
    expect(morningMessage(forecast([]), at, place).body.startsWith("วันนี้")).toBe(true);
  });

  it("ignores rain outside the daytime hours", () => {
    expect(morningMessage(forecast([2, 23]), at, place).body).toContain("ฝนไม่ตก");
  });

  it("names the rainy hours and suggests an umbrella", () => {
    const m = morningMessage(forecast([10, 11]), at, place);
    expect(m.body).toContain("10 โมงเช้า ถึง เที่ยง");
    expect(m.body).toContain("ร่ม");
  });
});

describe("alertMessage", () => {
  const f = (steps: [number, number, number][]): Forecast => ({
    slots: [],
    minutely: steps.map(([hour, minute, mm]) => ({ date: DATE, hour, minute, mm })),
  });
  const at = bangkokNow(new Date("2026-11-22T03:10:00Z")); // 10:10 Bangkok

  it("warns when rain is within 30 minutes", () => {
    const m = alertMessage(f([[10, 15, 0], [10, 30, 0.6]]), at, place);
    expect(m?.body).toContain("20 นาที");
  });

  it("stays quiet when rain is further away than 30 minutes", () => {
    expect(alertMessage(f([[10, 15, 0], [11, 0, 0.6]]), at, place)).toBeNull();
  });

  it("stays quiet when it is already raining", () => {
    expect(alertMessage(f([[10, 0, 0.6]]), at, place)).toBeNull();
  });

  it("stays quiet at night", () => {
    const night = bangkokNow(new Date("2026-11-22T14:10:00Z")); // 21:10 Bangkok
    expect(alertMessage(f([[21, 30, 0.6]]), night, place)).toBeNull();
  });
});

describe("advanceMessage", () => {
  // 10:10 Bangkok; rain in the hours listed, dry 15-minute data unless given.
  const at = bangkokNow(new Date("2026-11-22T03:10:00Z"));
  const withRain = (hours: number[], heavy = false, minutely: Forecast["minutely"] = []): Forecast => ({
    slots: Array.from({ length: 24 }, (_, h) => slot(h, hours.includes(h) ? (heavy ? 5 : 1) : 0)),
    minutely,
  });

  it("warns hours ahead and names the start time", () => {
    const m = advanceMessage(withRain([13]), at, place);
    expect(m?.body).toContain("อีกประมาณ 2 ชั่วโมง");
    expect(m?.body).toContain("บ่ายโมง");
    expect(m?.key).toBe("2026-11-22T13");
  });

  it("never overstates the lead time", () => {
    // 11:00 is 50 minutes away: under the one-hour minimum, so no early warning.
    expect(advanceMessage(withRain([11]), at, place)).toBeNull();
    // 12:00 is 110 minutes away: reported as 1 hour, not rounded up to 2.
    expect(advanceMessage(withRain([12]), at, place)?.body).toContain("อีกประมาณ 1 ชั่วโมง");
  });

  it("says when the coming rain is heavy", () => {
    expect(advanceMessage(withRain([12], true), at, place)?.body).toContain("ฝนตกหนัก");
  });

  it("stays quiet beyond three hours", () => {
    expect(advanceMessage(withRain([14]), at, place)).toBeNull();
  });

  it("stays quiet while it is already raining", () => {
    const raining = [{ date: DATE, hour: 10, minute: 0, mm: 0.8 }];
    expect(advanceMessage(withRain([12], false, raining), at, place)).toBeNull();
  });

  it("stays quiet at night", () => {
    const night = bangkokNow(new Date("2026-11-22T15:30:00Z")); // 22:30 Bangkok
    expect(advanceMessage(withRain([23]), night, place)).toBeNull();
  });

  it("warns about evening rain inside daytime hours", () => {
    const evening = bangkokNow(new Date("2026-11-22T13:10:00Z")); // 20:10 Bangkok
    const f: Forecast = {
      slots: [slot(21, 0), slot(22, 1), { ...slot(0, 0), date: "2026-11-23" }],
      minutely: [],
    };
    expect(advanceMessage(f, evening, place)?.key).toBe("2026-11-22T22");
  });
});
