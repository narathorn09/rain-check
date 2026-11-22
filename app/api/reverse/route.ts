import { NextRequest, NextResponse } from "next/server";
import { formatThaiAddress, type OsmAddress } from "@/lib/address";
import { validCoords } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const rawLat = req.nextUrl.searchParams.get("lat");
  const rawLon = req.nextUrl.searchParams.get("lon");
  const lat = rawLat === null ? NaN : Number(rawLat);
  const lon = rawLon === null ? NaN : Number(rawLon);
  if (!validCoords(lat, lon)) return NextResponse.json({ error: "bad coordinates" }, { status: 400 });

  // ~100 m precision is enough for a district name, shares one cache entry with neighbours,
  // and avoids sending an exact position to a third party.
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toFixed(3));
  url.searchParams.set("lon", lon.toFixed(3));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "th");

  try {
    // Nominatim's usage policy requires an identifying User-Agent and caching of results.
    const res = await fetch(url, {
      headers: { "User-Agent": "rain-check/0.1 (+https://rain-check-snowy.vercel.app)" },
      next: { revalidate: 7 * 86400 },
    });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    const data = (await res.json()) as { address?: OsmAddress };
    const name = data.address ? formatThaiAddress(data.address) : null;
    if (!name) return NextResponse.json({ error: "no name" }, { status: 404 });
    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ error: "lookup unavailable" }, { status: 502 });
  }
}
