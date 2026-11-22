"use client";

import { useState } from "react";
import { getPosition, placeName, type GeoError } from "@/lib/client/geo";
import { clock } from "@/lib/time";
import { CALL_NAMES, ROUTINES, type Profile } from "@/lib/profile";
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

/** Picks how น้องฝน addresses the user and what they usually do. */
export function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const custom = value.callName && !CALL_NAMES.includes(value.callName) ? value.callName : "";
  const [typed, setTyped] = useState(custom);
  const customRoutine = value.routine && !ROUTINES.includes(value.routine) ? value.routine : "";
  const [typedRoutine, setTypedRoutine] = useState(customRoutine);

  return (
    <div className="stack">
      <div>
        <p className="stepper-label">น้องฝนเรียกคุณว่า</p>
        <div className="chips">
          {CALL_NAMES.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${value.callName === n ? "on" : ""}`}
              aria-pressed={value.callName === n}
              onClick={() => {
                setTyped("");
                onChange({ ...value, callName: n });
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          className="text-input"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            onChange({ ...value, callName: e.target.value.slice(0, 30) });
          }}
          placeholder="หรือพิมพ์ชื่อเอง เช่น พี่สมศรี"
          aria-label="ชื่อที่ให้น้องฝนเรียก"
          maxLength={30}
        />
      </div>
      <div>
        <p className="stepper-label">ทำอะไรเป็นประจำ</p>
        <div className="chips">
          {[...ROUTINES, ""].map((r) => (
            <button
              key={r || "none"}
              type="button"
              className={`chip ${value.routine === r ? "on" : ""}`}
              aria-pressed={value.routine === r}
              onClick={() => {
                setTypedRoutine("");
                onChange({ ...value, routine: r });
              }}
            >
              {r || "ไม่ระบุ"}
            </button>
          ))}
        </div>
        <input
          className="text-input"
          value={typedRoutine}
          onChange={(e) => {
            setTypedRoutine(e.target.value);
            onChange({ ...value, routine: e.target.value.slice(0, 60) });
          }}
          placeholder="หรือพิมพ์เอง เช่น ขับวินมอเตอร์ไซค์"
          aria-label="สิ่งที่ทำเป็นประจำ"
          maxLength={60}
        />
      </div>
    </div>
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
      const name = await placeName(fix.lat, fix.lon);
      onPick({ name: name ?? "ที่ที่ฉันอยู่", lat: fix.lat, lon: fix.lon });
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
