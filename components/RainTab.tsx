"use client";

import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABEL, mergeRanges, minutesToRain, slotsInWindow, summarize } from "@/lib/rain";
import { addDays, bangkokNow, thaiHour } from "@/lib/time";
import type { Forecast, Level, Place } from "@/lib/types";

const ICON: Record<Level, string> = { dry: "☀️", light: "🌦️", heavy: "⛈️" };

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
      <div className="card">
        <p className="big">ดูข้อมูลฝนไม่ได้ในตอนนี้</p>
        <p className="note">ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่นะคะ</p>
        <button type="button" className="btn primary wide" onClick={load}>
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!forecast) return <div className="card"><p className="big">กำลังดูข้อมูลฝน…</p></div>;

  const now = bangkokNow();
  const tomorrow = addDays(now.date, 1);

  // Late in the evening nothing is left of today's daytime, so lead with tomorrow instead.
  const todaySlots = slotsInWindow(forecast.slots, now);
  const summary =
    todaySlots.length === 0
      ? summarize(slotsInWindow(forecast.slots, now, undefined, tomorrow), "พรุ่งนี้")
      : summarize(todaySlots, "วันนี้");

  const m = minutesToRain(forecast.minutely, now);
  const nowLine =
    m === null
      ? "ตอนนี้ฝนไม่ตก และใน 2-3 ชั่วโมงนี้ยังไม่มีฝน"
      : m === 0
        ? "ตอนนี้ฝนกำลังตกอยู่"
        : `ตอนนี้ฝนยังไม่ตก แต่อีกประมาณ ${Math.max(5, Math.round(m / 5) * 5)} นาทีฝนจะตก`;

  const date = day === "today" ? now.date : tomorrow;
  const daySlots = forecast.slots.filter((s) => s.date === date && (day === "tomorrow" || s.hour >= now.hour));
  const blocks = mergeRanges(daySlots);

  return (
    <div className="stack">
      <section className={`card hero ${summary.kind}`} aria-live="polite">
        <p className="hero-text">{summary.text}</p>
        <p className="hero-sub">{nowLine}</p>
      </section>

      <div className="seg" role="tablist" aria-label="เลือกวัน">
        <button type="button" role="tab" aria-selected={day === "today"} className={day === "today" ? "on" : ""} onClick={() => setDay("today")}>
          วันนี้
        </button>
        <button type="button" role="tab" aria-selected={day === "tomorrow"} className={day === "tomorrow" ? "on" : ""} onClick={() => setDay("tomorrow")}>
          พรุ่งนี้
        </button>
      </div>

      <div className="timeline">
        {blocks.length === 0 && <p className="note">หมดวันนี้แล้ว ลองดูของพรุ่งนี้นะคะ</p>}
        {blocks.map((b) => (
          <div key={`${b.start}-${b.level}`} className={`row ${b.level}`}>
            <div className="row-time">
              {thaiHour(b.start)}
              <span> ถึง </span>
              {thaiHour(b.end)}
            </div>
            <div className="row-state">
              <span aria-hidden="true">{ICON[b.level]}</span> {LEVEL_LABEL[b.level]}
            </div>
          </div>
        ))}
      </div>
      <p className="note">พยากรณ์อาจคลาดเคลื่อนได้ ถ้าไม่แน่ใจ พกร่มไว้ก่อนนะคะ</p>
    </div>
  );
}
