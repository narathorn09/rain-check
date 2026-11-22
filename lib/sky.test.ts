import { describe, expect, it } from "vitest";
import { reconcile, skyFromCode } from "./sky";

describe("skyFromCode", () => {
  it("maps WMO codes to Thai-relevant sky types", () => {
    expect(skyFromCode(0, true)).toBe("sunny");
    expect(skyFromCode(0, false)).toBe("clear");
    expect(skyFromCode(2, true)).toBe("partly");
    expect(skyFromCode(3, true)).toBe("cloudy");
    expect(skyFromCode(45, true)).toBe("fog");
    expect(skyFromCode(51, true)).toBe("drizzle");
    expect(skyFromCode(61, true)).toBe("rain");
    expect(skyFromCode(81, true)).toBe("moderate");
    expect(skyFromCode(65, true)).toBe("heavy");
    expect(skyFromCode(95, true)).toBe("storm");
    expect(skyFromCode(73, true)).toBe("cloudy");
  });
});

describe("reconcile", () => {
  it("keeps a dry sky when no rain is measured", () => {
    expect(reconcile("dry", "partly")).toEqual({ level: "dry", sky: "partly" });
  });

  it("lets a rainy code raise a dry rain level", () => {
    expect(reconcile("dry", "drizzle")).toEqual({ level: "light", sky: "drizzle" });
    expect(reconcile("dry", "storm")).toEqual({ level: "heavy", sky: "storm" });
  });

  it("shows rain when the amount says rain but the code says cloud", () => {
    expect(reconcile("light", "cloudy")).toEqual({ level: "light", sky: "rain" });
    expect(reconcile("heavy", "sunny")).toEqual({ level: "heavy", sky: "heavy" });
  });

  it("upgrades a light-rain picture when the amount is heavy", () => {
    expect(reconcile("heavy", "drizzle")).toEqual({ level: "heavy", sky: "heavy" });
  });
});
