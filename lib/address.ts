/** Subset of the OpenStreetMap Nominatim `address` object used for Thai place names. */
export interface OsmAddress {
  quarter?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  city?: string;
  town?: string;
  province?: string;
  state?: string;
}

// Thai readers know these short forms, and full names often wrap on a phone.
const SHORT: [RegExp, string][] = [
  [/^ตำบล/, "ต."],
  [/^อำเภอ/, "อ."],
  [/^จังหวัด/, "จ."],
];

const shorten = (s: string) => SHORT.reduce((acc, [re, to]) => acc.replace(re, to), s.trim());

/**
 * Builds "ต.X อ.Y จ.Z" (provinces) or "แขวงX เขตY กรุงเทพมหานคร" (Bangkok) from an OSM address.
 * Returns null when nothing usable is present.
 */
export function formatThaiAddress(a: OsmAddress): string | null {
  const local = a.city_district ?? a.quarter ?? a.village ?? a.hamlet;
  const district = a.county ?? a.suburb;
  // Bangkok has no province field; the city itself is the province-level name.
  const province = a.province ?? a.state ?? (a.city?.includes("กรุงเทพ") ? a.city : undefined);

  const parts = [local, district, province].filter((p): p is string => Boolean(p && p.trim())).map(shorten);
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  if (unique.length === 0) return a.town ?? a.city ?? null;
  return unique.join(" ");
}
