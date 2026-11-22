import { NextRequest, NextResponse } from "next/server";
import { GRID_HOURS, GRID_STEP, gridPoints, type RainGrid } from "@/lib/grid";
import { bangkokNow } from "@/lib/time";
import { validCoords } from "@/lib/weather";

interface PointForecast {
  hourly: { time: string[]; precipitation: (number | null)[] };
}

/** Hourly forecast rain for the next few hours on a grid around the place. */
export async function GET(req: NextRequest) {
  const rawLat = req.nextUrl.searchParams.get("lat");
  const rawLon = req.nextUrl.searchParams.get("lon");
  // Snap to the grid so nearby users share one cached upstream call.
  const lat = rawLat === null ? NaN : Math.round(Number(rawLat) / GRID_STEP) * GRID_STEP;
  const lon = rawLon === null ? NaN : Math.round(Number(rawLon) / GRID_STEP) * GRID_STEP;
  if (!validCoords(lat, lon)) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });

  const pts = gridPoints(lat, lon);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  // Open-Meteo accepts many locations in one request as comma-separated lists.
  url.searchParams.set("latitude", pts.map((p) => p.lat).join(","));
  url.searchParams.set("longitude", pts.map((p) => p.lon).join(","));
  url.searchParams.set("hourly", "precipitation");
  // One spare hour: depending on the minute, the first entry may be the current hour.
  url.searchParams.set("forecast_hours", String(GRID_HOURS + 2));
  url.searchParams.set("timezone", "Asia/Bangkok");

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const data = (await res.json()) as PointForecast[] | PointForecast;
    const list = Array.isArray(data) ? data : [data];
    if (list.length !== pts.length) throw new Error("grid size mismatch");

    // Frames start at the next full hour; drop the current hour if Open-Meteo included it.
    const now = bangkokNow();
    const currentHour = `${now.date}T${String(now.hour).padStart(2, "0")}:00`;
    const keep = list[0].hourly.time
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t > currentHour)
      .slice(0, GRID_HOURS);
    const grid: RainGrid = {
      times: keep.map(({ t }) => t),
      step: GRID_STEP,
      points: pts.map((p, n) => ({
        ...p,
        mm: keep.map(({ i }) => list[n].hourly.precipitation[i] ?? 0),
      })),
    };
    return NextResponse.json(grid);
  } catch (err) {
    console.error("rain-grid failed", err);
    return NextResponse.json({ error: "forecast unavailable" }, { status: 502 });
  }
}
