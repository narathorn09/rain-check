"use client";

export interface Fix {
  lat: number;
  lon: number;
}

export type GeoError = "denied" | "unavailable";

export function getPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject("unavailable" satisfies GeoError);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject((e.code === e.PERMISSION_DENIED ? "denied" : "unavailable") satisfies GeoError),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Thai place name for coordinates (e.g. "ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่"), or null. */
export async function placeName(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

/** True only when permission was already granted, so no prompt appears unexpectedly. */
export async function geoAlreadyGranted(): Promise<boolean> {
  try {
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state === "granted";
  } catch {
    return false;
  }
}
