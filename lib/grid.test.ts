import { describe, expect, it } from "vitest";
import { gridPoints, rainColor } from "./grid";

describe("gridPoints", () => {
  it("builds a square grid centred on the place, north-west first", () => {
    const pts = gridPoints(13.75, 100.5, 3, 0.1);
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ lat: 13.85, lon: 100.4 });
    expect(pts[4]).toEqual({ lat: 13.75, lon: 100.5 });
    expect(pts[8]).toEqual({ lat: 13.65, lon: 100.6 });
  });
});

describe("rainColor", () => {
  it("leaves dry cells clear and grades rain from blue to red", () => {
    expect(rainColor(0)).toBeNull();
    expect(rainColor(0.2)).toBe("#7fc8ff");
    expect(rainColor(4)).toBe("#f2c500");
    expect(rainColor(20)).toBe("#d4232a");
  });
});
