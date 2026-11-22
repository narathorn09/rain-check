"use client";

import { useCallback, useEffect, useState } from "react";
import { LEVEL_LABEL, minutesToRain, slotsInWindow, summarize } from "@/lib/rain";
import { addDays, bangkokNow, thaiHour } from "@/lib/time";
import type { Forecast, Level, Place, SellWindow, Slot } from "@/lib/types";

const ICON: Record<Level, string> = { dry: "☀️", light: "🌦️", heavy: "⛈️" };

interface Block {
  start: number;
  end: number;
  level: Level;
  inWindow: boolean;
}

function toBlocks(slots: Slot[], win: SellWindow): Block[] {
  const out: Block[] = [];
  for (const s of slots) {
    const inWindow = s.hour >= win.start && s.hour < win.end;
    const last = out[out.length - 1];
    if (last && last.level === s.level && last.inWindow === inWindow && last.end === s.hour) {
      last.end = s.hour + 1;
    } else {
      out.push({ start: s.hour, end: s.hour + 1, level: s.level, inWindow });
    }
  }
  return out;
}

/** Opens LINE's share picker with the text; falls back to the system share sheet. */
function shareToLine(text: string) {
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    window.location.href = lineUrl;
  } else if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open(lineUrl, "_blank", "noopener");
  }
}

export function RainTab({ place, win, nowTick }: { place: Place; win: SellWindow; nowTick: number }) {
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

  const todaySlots = slotsInWindow(forecast.slots, now, win);
  const showTomorrowSummary = todaySlots.length === 0;
  const summary = showTomorrowSummary
    ? summarize(slotsInWindow(forecast.slots, now, win, tomorrow), "พรุ่งนี้ช่วงขายของ")
    : summarize(todaySlots, "ช่วงขายของวันนี้");

  const m = minutesToRain(forecast.minutely, now);
  const nowLine =
    m === null
      ? "ตอนนี้ฝนไม่ตก และใน 2-3 ชั่วโมงนี้ยังไม่มีฝน"
      : m === 0
        ? "ตอนนี้ฝนกำลังตกอยู่"
        : `ตอนนี้ฝนยังไม่ตก แต่อีกประมาณ ${Math.max(5, Math.round(m / 5) * 5)} นาทีฝนจะตก`;

  const date = day === "today" ? now.date : tomorrow;
  const daySlots = forecast.slots.filter((s) => s.date === date && (day === "tomorrow" || s.hour >= now.hour));
  const blocks = toBlocks(daySlots, win);

  return (
    <div className="stack">
      <section className={`card hero ${summary.kind}`} aria-live="polite">
        <p className="hero-text">{summary.text}</p>
        <p className="hero-sub">{nowLine}</p>
        <button type="button" className="btn wide" onClick={() => shareToLine(`${summary.text} (${place.name})\n${nowLine}\n— เช็คฝน`)}>
          ส่งให้ไลน์
        </button>
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
          <div key={`${b.start}-${b.level}-${b.inWindow}`} className={`row ${b.level} ${b.inWindow ? "sell" : "off"}`}>
            <div className="row-time">
              {thaiHour(b.start)}
              <span> ถึง </span>
              {thaiHour(b.end)}
            </div>
            <div className="row-state">
              <span aria-hidden="true">{ICON[b.level]}</span> {LEVEL_LABEL[b.level]}
            </div>
            {b.inWindow && <div className="row-badge">ช่วงขายของ</div>}
          </div>
        ))}
      </div>
      <p className="note">พยากรณ์อาจคลาดเคลื่อนได้ ถ้าไม่แน่ใจ พกร่มไว้ก่อนนะคะ</p>
    </div>
  );
}
