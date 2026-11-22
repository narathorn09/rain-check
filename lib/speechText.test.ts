import { describe, expect, it } from "vitest";
import { splitForSpeech } from "./speechText";

describe("splitForSpeech", () => {
  it("keeps short text whole", () => {
    expect(splitForSpeech("วันนี้ฝนไม่ตกค่ะ")).toEqual(["วันนี้ฝนไม่ตกค่ะ"]);
  });

  it("breaks long text at spaces without exceeding the limit", () => {
    const text = "วันนี้จะมีฝนตกเบาๆ ตั้งแต่ช่วงบ่าย 3 โมง ถึง 5 โมงเย็นค่ะ คุณแม่อย่าลืมพกร่มด้วยนะคะ พอหลัง 6 โมงเย็นอากาศก็จะดีค่ะ";
    const chunks = splitForSpeech(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 40)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, "")).toBe(text.replace(/\s+/g, ""));
  });

  it("hard-cuts a run that has no spaces", () => {
    const chunks = splitForSpeech("ก".repeat(250), 100);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it("ignores empty input", () => {
    expect(splitForSpeech("   ")).toEqual([]);
  });
});
