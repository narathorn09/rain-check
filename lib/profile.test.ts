import { describe, expect, it } from "vitest";
import { cleanProfile } from "./profile";

describe("cleanProfile", () => {
  it("keeps normal values", () => {
    expect(cleanProfile({ callName: "คุณยาย", routine: "ทำสวน ทำนา" })).toEqual({
      callName: "คุณยาย",
      routine: "ทำสวน ทำนา",
    });
  });

  it("flattens line breaks and strips markup so the prompt stays one line", () => {
    expect(cleanProfile({ callName: "พี่\nสมศรี <b>", routine: 5 }).callName).toBe("พี่ สมศรี b");
  });

  it("caps the length and handles missing input", () => {
    expect(cleanProfile({ callName: "ก".repeat(50) }).callName).toHaveLength(30);
    expect(cleanProfile(null)).toEqual({ callName: "", routine: "" });
  });
});
