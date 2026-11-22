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

// Continuous colour ramp for the smooth forecast field: [mm/h, r, g, b, alpha].
// Roughly the radar's blue-green-yellow-red scale (and the legend in globals.css). Alpha starts
// at 0 so light rain fades in instead of starting at a hard edge.
const RAMP: [number, number, number, number, number][] = [
  [0.1, 127, 200, 255, 0],
  [0.3, 127, 200, 255, 0.5],
  [1, 58, 142, 230, 0.65],
  [2, 47, 179, 74, 0.72],
  [4, 242, 197, 0, 0.8],
  [8, 240, 120, 0, 0.85],
  [15, 212, 35, 42, 0.9],
];

/** RGBA (alpha 0-1) for an hourly rain amount on the continuous ramp. */
export function rainRamp(mm: number): [number, number, number, number] {
  if (!(mm > RAMP[0][0])) return [RAMP[0][1], RAMP[0][2], RAMP[0][3], 0];
  for (let i = 1; i < RAMP.length; i++) {
    const [m1, ...c1] = RAMP[i];
    if (mm <= m1) {
      const [m0, ...c0] = RAMP[i - 1];
      const t = (mm - m0) / (m1 - m0);
      return c0.map((v, k) => v + (c1[k] - v) * t) as [number, number, number, number];
    }
  }
  const last = RAMP[RAMP.length - 1];
  return [last[1], last[2], last[3], last[4]];
}

/**
 * Renders one forecast hour as a smooth RGBA image (row 0 = north), `px` pixels per grid cell.
 * Rain is interpolated between grid points, and the outer cell fades out so the square edge
 * of the grid does not show on the map.
 */
export function renderField(grid: RainGrid, hour: number, px = 12): { width: number; data: Uint8ClampedArray } {
  const size = Math.round(Math.sqrt(grid.points.length));
  const width = size * px;
  const data = new Uint8ClampedArray(width * width * 4);
  const mm = (r: number, c: number) => grid.points[r * size + c]?.mm[hour] ?? 0;
  for (let y = 0; y < width; y++) {
    const gy = Math.min(size - 1, Math.max(0, (y + 0.5) / px - 0.5));
    const r0 = Math.floor(gy);
    const r1 = Math.min(size - 1, r0 + 1);
    const ty = gy - r0;
    for (let x = 0; x < width; x++) {
      const gx = Math.min(size - 1, Math.max(0, (x + 0.5) / px - 0.5));
      const c0 = Math.floor(gx);
      const c1 = Math.min(size - 1, c0 + 1);
      const tx = gx - c0;
      const v =
        (mm(r0, c0) * (1 - tx) + mm(r0, c1) * tx) * (1 - ty) + (mm(r1, c0) * (1 - tx) + mm(r1, c1) * tx) * ty;
      const [r, g, b, a] = rainRamp(v);
      const edge = Math.min(x + 0.5, width - x - 0.5, y + 0.5, width - y - 0.5) / px;
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(255 * a * Math.min(1, edge));
    }
  }
  return { width, data };
}
