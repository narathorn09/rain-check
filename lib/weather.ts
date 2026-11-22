import { classify } from "./rain";
import { reconcile, skyFromCode } from "./sky";
import type { Forecast, Minutely, Slot } from "./types";

const BASE = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    precipitation: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code?: (number | null)[];
    is_day?: (number | null)[];
  };
  minutely_15?: { time: string[]; precipitation: (number | null)[] };
  current?: { weather_code?: number | null; is_day?: number | null; temperature_2m?: number | null };
}

export function validCoords(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = new URL(BASE);
  url.searchParams.set("latitude", lat.toFixed(3));
  url.searchParams.set("longitude", lon.toFixed(3));
  url.searchParams.set("hourly", "precipitation,precipitation_probability,weather_code,is_day");
  url.searchParams.set("minutely_15", "precipitation");
  url.searchParams.set("current", "weather_code,is_day,temperature_2m");
  url.searchParams.set("past_minutely_15", "2");
  url.searchParams.set("forecast_minutely_15", "12");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "Asia/Bangkok");

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;

  const slots: Slot[] = data.hourly.time.map((t, i) => {
    const mm = data.hourly.precipitation[i] ?? 0;
    const prob = data.hourly.precipitation_probability[i] ?? 0;
    const hour = Number(t.slice(11, 13));
    const code = data.hourly.weather_code?.[i];
    const dayFlag = data.hourly.is_day?.[i];
    // Without is_day, assume daylight 06:00-17:59 (Thailand stays close to that all year).
    const isDay = dayFlag != null ? dayFlag === 1 : hour >= 6 && hour < 18;
    const base = classify(mm, prob);
    const { level, sky } = code != null ? reconcile(base, skyFromCode(code, isDay)) : { level: base, sky: undefined };
    return { date: t.slice(0, 10), hour, mm, prob, level, sky };
  });

  const minutely: Minutely[] = (data.minutely_15?.time ?? []).map((t, i) => ({
    date: t.slice(0, 10),
    hour: Number(t.slice(11, 13)),
    minute: Number(t.slice(14, 16)),
    mm: data.minutely_15?.precipitation[i] ?? 0,
  }));

  const c = data.current;
  const current =
    c?.weather_code != null && c.temperature_2m != null
      ? { sky: skyFromCode(c.weather_code, c.is_day === 1), temp: c.temperature_2m }
      : undefined;

  return { slots, minutely, current };
}
