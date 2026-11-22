import { describe, expect, it } from "vitest";
import { splitForSpeech, takeSentences } from "./speechText";

describe("takeSentences", () => {
  const answer =
    "วันนี้ที่กรุงเทพมีฝนตกเบาๆ ช่วงบ่าย 3 โมงค่ะ อย่าลืมพกร่มไปด้วยนะคะ หลัง 6 โมงเย็นอากาศดีค่ะ";

  it("releases sentences that end with a polite particle and keeps the rest", () => {
    const { ready, rest } = takeSentences("วันนี้ที่กรุงเทพมีฝนตกเบาๆ ช่วงบ่าย 3 โมงค่ะ อย่าลืมพก");
    expect(ready).toEqual(["วันนี้ที่กรุงเทพมีฝนตกเบาๆ ช่วงบ่าย 3 โมงค่ะ"]);
    expect(rest).toBe(" อย่าลืมพก");
  });

  it("produces the whole answer once final, in order and without loss", () => {
    const { ready, rest } = takeSentences(answer, true);
    expect(rest).toBe("");
    expect(ready.join(" ").replace(/\s+/g, "")).toBe(answer.replace(/\s+/g, ""));
    expect(ready.length).toBe(3);
  });

  it("merges a too-short sentence into the next one", () => {
    const { ready } = takeSentences("ได้ค่ะ วันนี้ฝนไม่ตกเลยนะคะ ", false);
    expect(ready).toEqual(["ได้ค่ะ วันนี้ฝนไม่ตกเลยนะคะ"]);
  });

  it("does not end a sentence on คะ inside a word", () => {
    const { ready, rest } = takeSentences("คะแนนความชื้นวันนี้สูงมาก");
    expect(ready).toEqual([]);
    expect(rest).toBe("คะแนนความชื้นวันนี้สูงมาก");
  });

  it("cuts a long run with no ending at a space so speech can start", () => {
    const long = "ฝนจะตกเป็นช่วงๆ ".repeat(10);
    const { ready } = takeSentences(long);
    expect(ready.length).toBe(1);
    expect(ready[0].length).toBeLessThanOrEqual(110);
  });
});

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
