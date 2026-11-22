import { describe, expect, it } from "vitest";
import { alertMessage, morningMessage } from "./messages";
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
