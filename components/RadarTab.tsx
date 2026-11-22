"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, TileLayer } from "leaflet";
import type { Place } from "@/lib/types";
import { PauseIcon, PlayIcon } from "./Icons";
import { Mascot } from "./Mascot";

interface Frame {
  time: number;
  path: string;
}

const FRAME_MS = 700;

export function RadarTab({ place }: { place: Place }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layers = useRef<TileLayer[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [host, setHost] = useState("");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((d: { host: string; radar: { past: Frame[] } }) => {
        if (cancelled) return;
        const past = d.radar.past.slice(-8);
        setHost(d.host);
        setFrames(past);
        setIdx(past.length - 1);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the map once the frames are known.
  useEffect(() => {
    if (!box.current || frames.length === 0 || mapRef.current) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !box.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([place.lat, place.lon], 7);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 10,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      layers.current = frames.map((f) =>
        L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0,
          maxNativeZoom: 7,
          maxZoom: 10,
          zIndex: 5,
        }).addTo(map),
      );
      L.circleMarker([place.lat, place.lon], { radius: 9, color: "#ffffff", weight: 3, fillColor: "#d4232a", fillOpacity: 1 }).addTo(map);
      mapRef.current = map;
      layers.current[layers.current.length - 1]?.setOpacity(0.75);
    })();
    return () => {
      disposed = true;
    };
  }, [frames, host, place.lat, place.lon]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView([place.lat, place.lon], mapRef.current.getZoom());
  }, [place.lat, place.lon]);

  useEffect(() => {
    layers.current.forEach((l, i) => l.setOpacity(i === idx ? 0.75 : 0));
  }, [idx, frames]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const frame = frames[idx];
  const agoMin = frame ? Math.max(0, Math.round((Date.now() / 1000 - frame.time) / 60)) : 0;
  const clockText = frame
    ? new Date(frame.time * 1000).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
    : "";

  if (failed) {
    return (
      <div className="list">
        <div className="list-row block">
          <Mascot face="worried" size={64} />
          <p className="big">เปิดแผนที่เรดาร์ไม่ได้ในตอนนี้</p>
          <p className="note">ลองใหม่อีกครั้งภายหลังนะคะ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div ref={box} className="map" role="img" aria-label="แผนที่เรดาร์ฝน" />
      <div className="list">
        <div className="list-row player">
          <button
            type="button"
            className="play"
            onClick={() => setPlaying((p) => !p)}
            disabled={frames.length === 0}
            aria-label={playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="row-main">
            <p className="row-title">{frame ? `ภาพเวลา ${clockText} น.` : "กำลังโหลดภาพ…"}</p>
            {frame && <p className="row-sub">ผ่านมา {agoMin} นาที</p>}
          </div>
        </div>
        <div className="list-row">
          <Mascot face="think" size={56} />
          <div className="row-main">
            <p className="row-title">น้องฝนบอกวิธีดู</p>
            <p className="row-sub">เมฆฝนย้อนหลัง 1-2 ชั่วโมง สีน้ำเงิน-เขียว-เหลือง-แดง คือฝนเบาไปหนัก จุดแดงคือที่ของคุณค่ะ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
