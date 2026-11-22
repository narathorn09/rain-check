"use client";

import { useCallback, useEffect, useState } from "react";
import type { Place, SellWindow } from "../types";

export interface Settings {
  deviceId: string;
  sellSpot: Place | null;
  window: SellWindow;
  morning: boolean;
  morningMinutes: number;
  alert: boolean;
  setupDone: boolean;
}

const KEY = "rain-check:settings:v1";

function fresh(): Settings {
  return {
    deviceId: crypto.randomUUID(),
    sellSpot: null,
    window: { start: 6, end: 14 },
    morning: true,
    morningMinutes: 5 * 60 + 30,
    alert: true,
    setupDone: false,
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<Settings>) };
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
