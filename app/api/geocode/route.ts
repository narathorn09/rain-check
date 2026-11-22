import { NextRequest, NextResponse } from "next/server";

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin2?: string;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("language", "th");
  url.searchParams.set("countryCode", "TH");
  url.searchParams.set("count", "8");

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return NextResponse.json({ error: "search unavailable" }, { status: 502 });
  const data = (await res.json()) as { results?: GeoResult[] };

  const results = (data.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin2, r.admin1].filter(Boolean).join(" "),
    lat: r.latitude,
    lon: r.longitude,
  }));
  return NextResponse.json({ results });
}
