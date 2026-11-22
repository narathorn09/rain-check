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

/** True only when permission was already granted, so no prompt appears unexpectedly. */
export async function geoAlreadyGranted(): Promise<boolean> {
  try {
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state === "granted";
  } catch {
    return false;
  }
}
