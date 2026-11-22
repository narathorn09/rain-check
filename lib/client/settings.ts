"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "../profile";
import type { Place } from "../types";

export interface Settings extends Profile {
  deviceId: string;
  place: Place | null;
  morning: boolean;
  morningMinutes: number;
  alert: boolean;
  setupDone: boolean;
  /** Index into VOLUME_LEVELS. */
  volume: number;
}

/** Speech volume steps; the gain feeds the playback limiter, so louder never clips. */
export const VOLUME_LEVELS = [
  { label: "เบา", gain: 0.7 },
  { label: "ปกติ", gain: 1 },
  { label: "ดัง", gain: 1.8 },
  { label: "ดังมาก", gain: 2.8 },
  { label: "ดังที่สุด", gain: 4 },
];
// "ดัง": phone speakers made the recorded level hard to hear for older users.
const DEFAULT_VOLUME = 2;

const KEY = "rain-check:settings:v1";

function fresh(): Settings {
  return {
    deviceId: crypto.randomUUID(),
    place: null,
    morning: true,
    morningMinutes: 5 * 60 + 30,
    alert: true,
    setupDone: false,
    volume: DEFAULT_VOLUME,
    callName: "",
    routine: "",
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Older versions stored the place as `sellSpot` next to a selling-hours `window`.
      const { sellSpot, window: _unused, ...saved } = JSON.parse(raw) as Partial<Settings> & {
        sellSpot?: Place | null;
        window?: unknown;
      };
      return {
        ...fresh(),
        ...saved,
        place: saved.place ?? sellSpot ?? null,
        // Phones set up before profiles existed belong to the original user, a market seller.
        callName: saved.callName ?? "คุณแม่",
        routine: saved.routine ?? "ขายของกลางแจ้ง",
        volume: Number.isInteger(saved.volume)
          ? Math.min(VOLUME_LEVELS.length - 1, Math.max(0, saved.volume as number))
          : DEFAULT_VOLUME,
      };
    }
  } catch {
    // Storage can be blocked; fall through to defaults.
  }
  return fresh();
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const s = load();
    setSettings(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Keeps working for this session without persistence.
    }
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Ignore: see above.
      }
      return next;
    });
  }, []);

  return { settings, update };
}
