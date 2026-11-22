"use client";

import { useState } from "react";
import { getPosition, type GeoError } from "@/lib/client/geo";
import { clock, thaiHour } from "@/lib/time";
import type { Place, SellWindow } from "@/lib/types";

/** Large +/- control; avoids small wheel pickers that are hard to use. */
export function Stepper({
  label,
  text,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  text: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button type="button" className="btn round" onClick={onMinus} disabled={minusDisabled} aria-label={`${label} ลด`}>
          −
        </button>
        <div className="stepper-value">{text}</div>
        <button type="button" className="btn round" onClick={onPlus} disabled={plusDisabled} aria-label={`${label} เพิ่ม`}>
          +
        </button>
      </div>
    </div>
  );
}

export function WindowEditor({ value, onChange }: { value: SellWindow; onChange: (w: SellWindow) => void }) {
  return (
    <>
      <Stepper
        label="เริ่มขายของ"
        text={thaiHour(value.start)}
        onMinus={() => onChange({ ...value, start: value.start - 1 })}
        onPlus={() => onChange({ ...value, start: value.start + 1 })}
        minusDisabled={value.start <= 0}
        plusDisabled={value.start + 1 >= value.end}
      />
      <Stepper
        label="เลิกขายของ"
        text={thaiHour(value.end)}
        onMinus={() => onChange({ ...value, end: value.end - 1 })}
        onPlus={() => onChange({ ...value, end: value.end + 1 })}
        minusDisabled={value.end - 1 <= value.start}
        plusDisabled={value.end >= 24}
      />
    </>
  );
}

export function MorningTimeEditor({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  return (
    <Stepper
      label="เวลาส่งสรุปตอนเช้า"
      text={`${clock(minutes)} น.`}
      onMinus={() => onChange(minutes - 30)}
      onPlus={() => onChange(minutes + 30)}
      minusDisabled={minutes <= 3 * 60}
      plusDisabled={minutes >= 9 * 60}
    />
  );
}

export function Switch({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <button type="button" className="switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span>
        <span className="switch-title">{title}</span>
        <span className="switch-hint">{hint}</span>
      </span>
      <span className={`switch ${checked ? "on" : ""}`}>{checked ? "เปิด" : "ปิด"}</span>
    </button>
  );
}

interface Hit {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

/** GPS button plus a name search (district, market, province). */
export function PlacePicker({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function useGps() {
    setBusy(true);
    setMsg("");
    try {
      const fix = await getPosition();
      onPick({ name: "จุดที่ฉันอยู่", lat: fix.lat, lon: fix.lon });
    } catch (e) {
      setMsg(
        (e as GeoError) === "denied"
          ? "ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง ลองค้นหาชื่อสถานที่ด้านล่างแทนได้ค่ะ"
          : "หาตำแหน่งไม่เจอ ลองค้นหาชื่อสถานที่ด้านล่างแทนได้ค่ะ",
      );
    }
    setBusy(false);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as { results?: Hit[] };
      setHits(data.results ?? []);
      if (!data.results?.length) setMsg("ไม่พบสถานที่นี้ ลองพิมพ์ชื่ออำเภอหรือจังหวัดดูนะคะ");
    } catch {
      setMsg("ค้นหาไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะคะ");
    }
    setBusy(false);
  }

  return (
    <div className="picker">
      <button type="button" className="btn primary wide" onClick={useGps} disabled={busy}>
        ใช้ตำแหน่งที่ฉันอยู่ตอนนี้
      </button>
      <form onSubmit={search} className="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="หรือพิมพ์ชื่ออำเภอ / จังหวัด"
          aria-label="ค้นหาสถานที่"
          enterKeyHint="search"
        />
        <button type="submit" className="btn" disabled={busy}>
          ค้นหา
        </button>
      </form>
      {msg && <p className="note">{msg}</p>}
      {hits?.map((h) => (
        <button
          key={`${h.lat},${h.lon}`}
          type="button"
          className="btn hit"
          onClick={() => onPick({ name: h.name, lat: h.lat, lon: h.lon })}
        >
          <strong>{h.name}</strong>
          <span>{h.detail}</span>
        </button>
      ))}
    </div>
  );
}
