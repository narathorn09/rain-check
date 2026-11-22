"use client";

import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABEL, mergeRanges, minutesToRain, slotsInWindow, summarize } from "@/lib/rain";
import { addDays, bangkokNow, thaiHour } from "@/lib/time";
import type { Forecast, Level, Place } from "@/lib/types";
import { LevelIcon } from "./Icons";
import { WeatherScene } from "./WeatherScene";

const LEVELS: Level[] = ["dry", "light", "heavy"];

export function RainTab({ place, nowTick }: { place: Place; nowTick: number }) {
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
        <WeatherScene level="light" className="hero-scene" />
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
        <div className="hero-body">
          <p className="big">กำลังดูข้อมูลฝน…</p>
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
  // The picture shows the sky right now; the 15-minute data is the better signal for "now".
  const nowLevel: Level = m === 0 ? (thisHour?.level === "heavy" ? "heavy" : "light") : "dry";
  const nowLine =
    m === null
      ? "ใน 2-3 ชั่วโมงนี้ยังไม่มีฝน"
      : m === 0
        ? "ฝนกำลังตกอยู่ตอนนี้"
        : `อีกประมาณ ${Math.max(5, Math.round(m / 5) * 5)} นาทีฝนจะตก`;

  const date = day === "today" ? now.date : tomorrow;
  const daySlots = forecast.slots.filter((s) => s.date === date && (day === "tomorrow" || s.hour >= now.hour));
  const blocks = mergeRanges(daySlots);

  return (
    <div className="stack">
      <section className="hero" aria-live="polite">
        <WeatherScene level={nowLevel} className="hero-scene" />
        <div className="hero-body">
          <span className={`hero-now ${nowLevel}`}>ตอนนี้: {LEVEL_LABEL[nowLevel]}</span>
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
          <div key={`${b.start}-${b.level}`} className="list-row">
            <div className={`lead ${b.level}`}>
              <LevelIcon level={b.level} />
            </div>
            <div className="row-main">
              <p className="row-title">
                {thaiHour(b.start)} ถึง {thaiHour(b.end)}
              </p>
              <p className={`row-sub ${b.level}`}>{LEVEL_LABEL[b.level]}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="section-label">ภาพแต่ละแบบหมายถึงอะไร</p>
      <div className="legend">
        {LEVELS.map((l) => (
          <figure key={l}>
            <WeatherScene level={l} />
            <figcaption className={`row-sub ${l}`}>{LEVEL_LABEL[l]}</figcaption>
          </figure>
        ))}
      </div>
      <p className="note">พยากรณ์อาจคลาดเคลื่อนได้ ถ้าไม่แน่ใจ พกร่มไว้ก่อนนะคะ</p>
    </div>
  );
}
