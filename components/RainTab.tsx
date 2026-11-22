"use client";

import { useCallback, useEffect, useState } from "react";
import { mergeBySky, minutesToRain, slotsInWindow, summarize } from "@/lib/rain";
import { isRainy, levelOfSky, SKY_LABEL, skyOf, type Sky } from "@/lib/sky";
import { addDays, bangkokNow, thaiHour } from "@/lib/time";
import type { Forecast, Place } from "@/lib/types";
import { PinIcon, SkyIcon } from "./Icons";
import { Mascot, mascotFor } from "./Mascot";
import { WeatherScene } from "./WeatherScene";

// Night-time "clear" is left out: the legend explains daytime pictures.
const LEGEND: Sky[] = ["sunny", "partly", "cloudy", "fog", "drizzle", "rain", "moderate", "heavy", "storm"];

export function RainTab({ place, here, nowTick }: { place: Place; here: boolean; nowTick: number }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState<"today" | "tomorrow">("today");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/forecast?lat=${place.lat}&lon=${place.lon}`);
      if (!res.ok) throw new Error();
      setForecast((await res.json()) as Forecast);
      setError(false);
    } catch {
      setError(true);
    }
  }, [place.lat, place.lon]);

  // Drop the old place's data right away so it is never shown under the new name.
  useEffect(() => {
    setForecast(null);
  }, [place.lat, place.lon]);

  // Also refreshes when the app returns to the foreground or the parent ticks (every 5 minutes).
  useEffect(() => {
    load();
  }, [nowTick, load]);

  if (error && !forecast) {
    return (
      <div className="hero">
        <div className="hero-art">
          <WeatherScene sky="cloudy" className="hero-scene" />
          <div className="hero-mascot">
            <Mascot face="worried" size={88} />
          </div>
          <p className="say">ขอโทษค่ะ น้องฝนดูข้อมูลไม่ได้</p>
        </div>
        <div className="hero-body">
          <p className="big">ดูข้อมูลฝนไม่ได้ในตอนนี้</p>
          <p className="note">ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่นะคะ</p>
          <button type="button" className="btn primary wide" onClick={load}>
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }
  if (!forecast) {
    return (
      <div className="hero">
        <div className="mascot-banner">
          <Mascot face="think" size={64} />
          <p className="big">น้องฝนกำลังดูข้อมูลฝนให้ค่ะ…</p>
        </div>
      </div>
    );
  }

  const now = bangkokNow();
  const tomorrow = addDays(now.date, 1);

  // Late in the evening nothing is left of today's daytime, so lead with tomorrow instead.
  const todaySlots = slotsInWindow(forecast.slots, now);
  const summary =
    todaySlots.length === 0
      ? summarize(slotsInWindow(forecast.slots, now, undefined, tomorrow), "พรุ่งนี้")
      : summarize(todaySlots, "วันนี้");

  const m = minutesToRain(forecast.minutely, now);
  const thisHour = forecast.slots.find((s) => s.date === now.date && s.hour === now.hour);
  const reported = forecast.current?.sky ?? (thisHour ? skyOf(thisHour) : "sunny");
  // The 15-minute rain data decides wet or dry right now, so the picture never
  // shows rain while the text says it is dry (or the other way round).
  const heroSky: Sky =
    m === 0
      ? isRainy(reported)
        ? reported
        : thisHour?.level === "heavy"
          ? "heavy"
          : "rain"
      : isRainy(reported)
        ? "cloudy"
        : reported;
  const temp = forecast.current ? `${Math.round(forecast.current.temp)}°` : "";
  const buddy = mascotFor(heroSky);

  const nowLine =
    m === null
      ? "ใน 2-3 ชั่วโมงนี้ยังไม่มีฝน"
      : m === 0
        ? "ฝนกำลังตกอยู่ตอนนี้"
        : `อีกประมาณ ${Math.max(5, Math.round(m / 5) * 5)} นาทีฝนจะตก`;

  const date = day === "today" ? now.date : tomorrow;
  const daySlots = forecast.slots.filter((s) => s.date === date && (day === "tomorrow" || s.hour >= now.hour));
  const blocks = mergeBySky(daySlots);

  return (
    <div className="stack">
      <section className="hero" aria-live="polite">
        <div className="hero-art">
          <WeatherScene sky={heroSky} className="hero-scene" />
          <div className="hero-mascot">
            <Mascot face={buddy.face} prop={buddy.prop} size={88} />
          </div>
          <p className="say">{buddy.line}</p>
        </div>
        <div className="hero-body">
          <p className="hero-place">
            <PinIcon />
            {here ? "ตอนนี้อยู่ที่ " : ""}
            {place.name}
          </p>
          <span className={`hero-now ${levelOfSky(heroSky)}`}>
            ตอนนี้: {SKY_LABEL[heroSky]}
            {temp && ` · ${temp}`}
          </span>
          <p className="hero-text">{summary.text}</p>
          <p className="hero-sub">{nowLine}</p>
        </div>
      </section>

      <div className="list">
        <div className="tabline" role="tablist" aria-label="เลือกวัน">
          <button type="button" role="tab" aria-selected={day === "today"} className={day === "today" ? "on" : ""} onClick={() => setDay("today")}>
            วันนี้
          </button>
          <button type="button" role="tab" aria-selected={day === "tomorrow"} className={day === "tomorrow" ? "on" : ""} onClick={() => setDay("tomorrow")}>
            พรุ่งนี้
          </button>
        </div>
        {blocks.length === 0 && (
          <div className="list-row">
            <p className="note">หมดวันนี้แล้ว ลองดูของพรุ่งนี้นะคะ</p>
          </div>
        )}
        {blocks.map((b) => (
          <div key={`${b.start}-${b.sky}`} className="list-row">
            <div className={`lead ${b.level}`}>
              <SkyIcon sky={b.sky} />
            </div>
            <div className="row-main">
              <p className="row-title">
                {thaiHour(b.start)} ถึง {thaiHour(b.end)}
              </p>
              <p className={`row-sub ${b.level}`}>{SKY_LABEL[b.sky]}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="section-label">ภาพแต่ละแบบหมายถึงอะไร</p>
      <div className="legend">
        {LEGEND.map((s) => (
          <figure key={s}>
            <WeatherScene sky={s} />
            <figcaption className={`row-sub ${levelOfSky(s)}`}>{SKY_LABEL[s]}</figcaption>
          </figure>
        ))}
      </div>
      <p className="note">พยากรณ์อาจคลาดเคลื่อนได้ ถ้าไม่แน่ใจ พกร่มไว้ก่อนนะคะ</p>
    </div>
  );
}
