import type { Sky } from "./sky";

export type Level = "dry" | "light" | "heavy";

export interface Slot {
  /** Local Bangkok date, YYYY-MM-DD. */
  date: string;
  hour: number;
  mm: number;
  prob: number;
  level: Level;
  /** Display condition; optional so hand-built slots (tests) can fall back to `level`. */
  sky?: Sky;
}

export interface Minutely {
  date: string;
  hour: number;
  minute: number;
  mm: number;
}

export interface Forecast {
  slots: Slot[];
  minutely: Minutely[];
  current?: { sky: Sky; temp: number };
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface HourRange {
  /** Start hour, 0-23. */
  start: number;
  /** End hour (exclusive), 1-24. */
  end: number;
}

export interface DeviceRecord {
  id: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  place: Place;
  /** How to address the user in notifications; empty for no name. */
  callName?: string;
  morning: boolean;
  /** Minutes after midnight (Bangkok) for the morning summary. */
  morningMinutes: number;
  alert: boolean;
  lastMorning?: string;
  lastAlert?: number;
  /** Rain spell (date + start hour) that already got an hours-ahead warning. */
  lastAdvance?: string;
}
