import { describe, expect, it } from "vitest";
import { formatThaiAddress } from "./address";

// Shapes taken from real Nominatim responses (accept-language=th).
describe("formatThaiAddress", () => {
  it("formats Bangkok as แขวง เขต กรุงเทพมหานคร", () => {
    expect(
      formatThaiAddress({ quarter: "แขวงสุริยวงศ์", suburb: "เขตบางรัก", city: "กรุงเทพมหานคร" }),
    ).toBe("แขวงสุริยวงศ์ เขตบางรัก กรุงเทพมหานคร");
  });

  it("formats provinces with ต. อ. จ.", () => {
    expect(
      formatThaiAddress({
        suburb: "แขวงศรีวิชัย",
        city_district: "ตำบลสุเทพ",
        city: "เทศบาลนครเชียงใหม่",
        county: "อำเภอเมืองเชียงใหม่",
        province: "จังหวัดเชียงใหม่",
      }),
    ).toBe("ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่");
  });

  it("falls back to the town when no admin levels are present", () => {
    expect(formatThaiAddress({ town: "เทศบาลเมืองปทุมธานี" })).toBe("เทศบาลเมืองปทุมธานี");
  });

  it("returns null for an empty address", () => {
    expect(formatThaiAddress({})).toBeNull();
  });
});
