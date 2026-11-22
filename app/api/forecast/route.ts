import { NextRequest, NextResponse } from "next/server";
import { fetchForecast, validCoords } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const rawLat = req.nextUrl.searchParams.get("lat");
  const rawLon = req.nextUrl.searchParams.get("lon");
  // Number(null) is 0, so a missing parameter must be rejected explicitly.
  const lat = rawLat === null ? NaN : Number(rawLat);
  const lon = rawLon === null ? NaN : Number(rawLon);
  if (!validCoords(lat, lon)) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });
  try {
    return NextResponse.json(await fetchForecast(lat, lon));
  } catch {
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
