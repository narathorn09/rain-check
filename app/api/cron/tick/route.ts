import { NextRequest, NextResponse } from "next/server";
import { alertMessage, morningMessage } from "@/lib/messages";
import { DAY_HOURS } from "@/lib/rain";
import { sendNotice } from "@/lib/push";
import { listDevices, saveDevice } from "@/lib/store";
import { bangkokNow } from "@/lib/time";
import { fetchForecast } from "@/lib/weather";
import type { DeviceRecord, Forecast } from "@/lib/types";

export const maxDuration = 60;

const ALERT_COOLDOWN_MS = 90 * 60 * 1000;
// The scheduler can run late, so the morning summary stays valid for a while after its time.
const MORNING_GRACE_MIN = 120;

/** Called every ~10 minutes by an external scheduler (see .github/workflows/tick.yml). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = bangkokNow();
  const devices = await listDevices();
  const forecasts = new Map<string, Promise<Forecast>>();
  const forecastFor = (d: DeviceRecord) => {
    // Round to ~1 km so nearby devices share one upstream call.
    const k = `${d.place.lat.toFixed(2)},${d.place.lon.toFixed(2)}`;
    if (!forecasts.has(k)) forecasts.set(k, fetchForecast(d.place.lat, d.place.lon));
    return forecasts.get(k)!;
  };

  let sent = 0;
  for (const d of devices) {
    try {
      const dueMorning =
        d.morning &&
        d.lastMorning !== now.date &&
        now.minutesOfDay >= d.morningMinutes &&
        now.minutesOfDay < d.morningMinutes + MORNING_GRACE_MIN;
      const inDay = now.hour >= DAY_HOURS.start && now.hour < DAY_HOURS.end;
      const dueAlert = d.alert && inDay && Date.now() - (d.lastAlert ?? 0) > ALERT_COOLDOWN_MS;
      if (!dueMorning && !dueAlert) continue;

      const f = await forecastFor(d);
      let next = d;
      if (dueMorning) {
        // Mark first so a failed send is not retried every 10 minutes all morning.
        next = { ...next, lastMorning: now.date };
        await saveDevice(next);
        if (await sendNotice(d, morningMessage(f, now, d.place))) sent++;
      }
      if (dueAlert) {
        const msg = alertMessage(f, now, d.place);
        if (msg) {
          next = { ...next, lastAlert: Date.now() };
          await saveDevice(next);
          if (await sendNotice(d, msg)) sent++;
        }
      }
    } catch (err) {
      console.error("tick failed for a device", err);
    }
  }
  return NextResponse.json({ devices: devices.length, sent });
}
