import { describe, expect, it } from "vitest";
import { gridPoints, rainRamp, renderField, type RainGrid } from "./grid";

describe("rainRamp", () => {
  it("is clear when dry and grows more opaque with heavier rain", () => {
    expect(rainRamp(0)[3]).toBe(0);
    expect(rainRamp(0.3)[3]).toBeCloseTo(0.5);
    expect(rainRamp(3)[3]).toBeGreaterThan(rainRamp(1)[3]);
    expect(rainRamp(50)).toEqual([212, 35, 42, 0.9]);
  });

  it("blends between neighbouring colours", () => {
    const [r, g, b] = rainRamp(1.5);
    expect(r).toBeCloseTo((58 + 47) / 2);
    expect(g).toBeCloseTo((142 + 179) / 2);
    expect(b).toBeCloseTo((230 + 74) / 2);
  });
});

describe("renderField", () => {
  // 3x3 grid with heavy rain only at the centre point.
  const grid: RainGrid = {
    times: ["2026-11-22T15:00"],
    step: 0.1,
    points: Array.from({ length: 9 }, (_, i) => ({ lat: 0, lon: 0, mm: [i === 4 ? 10 : 0] })),
  };
  const alphaAt = (f: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
    f.data[(y * f.width + x) * 4 + 3];

  it("peaks at the rainy point and fades smoothly away from it", () => {
    const f = renderField(grid, 0, 10);
    expect(f.width).toBe(30);
    const centre = alphaAt(f, 15, 15);
    const between = alphaAt(f, 10, 15);
    expect(centre).toBeGreaterThan(between);
    expect(between).toBeGreaterThan(0);
    // Corners are dry and on the faded edge.
    expect(alphaAt(f, 0, 0)).toBe(0);
  });
});

describe("gridPoints", () => {
  it("builds a square grid centred on the place, north-west first", () => {
    const pts = gridPoints(13.75, 100.5, 3, 0.1);
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ lat: 13.85, lon: 100.4 });
    expect(pts[4]).toEqual({ lat: 13.75, lon: 100.5 });
    expect(pts[8]).toEqual({ lat: 13.65, lon: 100.6 });
  });
});
