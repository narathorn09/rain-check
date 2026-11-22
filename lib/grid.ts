/** Forecast rain on a square grid around a place, for the radar tab's "ahead" frames. */
export interface RainGrid {
  /** Local Bangkok hour labels, YYYY-MM-DDTHH:00, one per forecast frame. */
  times: string[];
  /** Grid spacing in degrees; each point is the centre of a cell this wide. */
  step: number;
  points: { lat: number; lon: number; mm: number[] }[];
}

export const GRID_SIZE = 9;
// ~11 km between points: close to the forecast model's own resolution, so finer adds nothing.
export const GRID_STEP = 0.1;
export const GRID_HOURS = 6;

/** Grid of points centred on (lat, lon), row by row from the north-west corner. */
export function gridPoints(lat: number, lon: number, size = GRID_SIZE, step = GRID_STEP) {
  const half = (size - 1) / 2;
  const out: { lat: number; lon: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out.push({
        lat: Number((lat + (half - r) * step).toFixed(3)),
        lon: Number((lon + (c - half) * step).toFixed(3)),
      });
    }
  }
  return out;
}

/**
 * Colour for an hourly rain amount, roughly matching the radar's blue-green-yellow-red scale.
 * Returns null for no rain so the map stays clear there.
 */
export function rainColor(mm: number): string | null {
  if (mm < 0.1) return null;
  if (mm < 0.5) return "#7fc8ff";
  if (mm < 1.5) return "#3a8ee6";
  if (mm < 3) return "#2fb34a";
  if (mm < 6) return "#f2c500";
  if (mm < 10) return "#f07800";
  return "#d4232a";
}
