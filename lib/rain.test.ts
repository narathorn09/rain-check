import { describe, expect, it } from "vitest";
import { classify, mergeRanges, minutesToRain, slotsInWindow, summarize } from "./rain";
import { bangkokNow, thaiHour } from "./time";
import type { Slot } from "./types";

const slot = (hour: number, mm: number, prob = 0, date = "2026-11-22"): Slot => ({
  date,
  hour,
  mm,
  prob,
  level: classify(mm, prob),
});

describe("classify", () => {
  it("splits dry, light and heavy", () => {
    expect(classify(0, 10)).toBe("dry");
    expect(classify(0.3, 10)).toBe("light");
    expect(classify(2.5, 10)).toBe("heavy");
  });
  it("treats a very high probability as light rain", () => {
    expect(classify(0, 80)).toBe("light");
  });
});

describe("thaiHour", () => {
  it("speaks Thai clock words", () => {
    expect(thaiHour(0)).toBe("เที่ยงคืน");
    expect(thaiHour(3)).toBe("ตี 3");
    expect(thaiHour(10)).toBe("10 โมงเช้า");
    expect(thaiHour(12)).toBe("เที่ยง");
    expect(thaiHour(13)).toBe("บ่ายโมง");
    expect(thaiHour(14)).toBe("บ่าย 2 โมง");
    expect(thaiHour(17)).toBe("5 โมงเย็น");
    expect(thaiHour(19)).toBe("1 ทุ่ม");
    expect(thaiHour(24)).toBe("เที่ยงคืน");
  });
});

describe("bangkokNow", () => {
  it("rolls the date over at 17:00 UTC", () => {
    const n = bangkokNow(new Date("2026-11-22T17:30:00Z"));
    expect(n).toMatchObject({ date: "2026-11-23", hour: 0, minute: 30 });
  });
});

describe("mergeRanges and summarize", () => {
  const slots = [slot(8, 0), slot(9, 0), slot(10, 0.5), slot(11, 3), slot(12, 0), slot(13, 0.2)];

  it("merges consecutive hours with the same level", () => {
    expect(mergeRanges(slots).map((r) => [r.start, r.end, r.level])).toEqual([
      [8, 10, "dry"],
      [10, 11, "light"],
      [11, 12, "heavy"],
      [12, 13, "dry"],
      [13, 14, "light"],
    ]);
  });

  it("describes rain periods in Thai", () => {
    const s = summarize(slots, "ช่วงขายของวันนี้");
    expect(s.kind).toBe("rain");
    expect(s.text).toContain("10 โมงเช้า ถึง 11 โมงเช้า");
    expect(s.text).toContain("(ตกหนัก)");
  });

  it("reports a dry window", () => {
    expect(summarize([slot(8, 0), slot(9, 0)], "วันนี้").kind).toBe("dry");
  });
});

describe("slotsInWindow", () => {
  it("skips past hours today but not tomorrow", () => {
    const now = bangkokNow(new Date("2026-11-22T03:10:00Z")); // 10:10 Bangkok
    const all = [...[8, 9, 10, 11, 12].map((h) => slot(h, 0)), slot(9, 0, 0, "2026-11-23")];
    expect(slotsInWindow(all, now, { start: 8, end: 12 }).map((s) => s.hour)).toEqual([10, 11]);
    expect(slotsInWindow(all, now, { start: 8, end: 12 }, "2026-11-23").map((s) => s.hour)).toEqual([9]);
  });
});

describe("minutesToRain", () => {
  const now = bangkokNow(new Date("2026-11-22T03:10:00Z")); // 10:10 Bangkok
  const m = (hour: number, minute: number, mm: number) => ({ date: "2026-11-22", hour, minute, mm });

  it("returns minutes until the first wet step", () => {
    expect(minutesToRain([m(10, 0, 0), m(10, 15, 0), m(10, 30, 0.4)], now)).toBe(20);
  });
  it("returns 0 when it is raining now", () => {
    expect(minutesToRain([m(10, 0, 0.5)], now)).toBe(0);
  });
  it("returns null when it stays dry", () => {
    expect(minutesToRain([m(10, 15, 0), m(10, 30, 0)], now)).toBeNull();
  });
});
