"use client";

import { useState } from "react";
import { getPosition, type GeoError } from "@/lib/client/geo";
import { clock } from "@/lib/time";
import type { Place } from "@/lib/types";
import { PinIcon } from "./Icons";

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

/** Settings-list row with a chat-app style toggle; the whole row is the tap target. */
export function SwitchRow({
  checked,
  onChange,
  title,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <button type="button" className="list-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="lead">{icon}</span>
      <span className="row-main">
        <span className="row-title" style={{ display: "block" }}>{title}</span>
        <span className="row-sub" style={{ display: "block" }}>{hint}</span>
      </span>
      <span className={`toggle ${checked ? "on" : ""}`}>
        {checked ? "เปิด" : "ปิด"}
        <i aria-hidden="true" />
      </span>
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
      onPick({ name: "ที่ที่ฉันอยู่", lat: fix.lat, lon: fix.lon });
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
          placeholder="ชื่ออำเภอ หรือ จังหวัด"
          aria-label="ค้นหาสถานที่"
          enterKeyHint="search"
        />
        <button type="submit" className="btn" disabled={busy}>
          ค้นหา
        </button>
      </form>
      {msg && <p className="note">{msg}</p>}
      {hits && hits.length > 0 && (
        <div className="list" style={{ border: "1px solid var(--line)" }}>
          {hits.map((h) => (
            <button
              key={`${h.lat},${h.lon}`}
              type="button"
              className="list-row"
              onClick={() => onPick({ name: h.name, lat: h.lat, lon: h.lon })}
            >
              <span className="lead">
                <PinIcon />
              </span>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>{h.name}</span>
                <span className="row-sub" style={{ display: "block" }}>{h.detail}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
