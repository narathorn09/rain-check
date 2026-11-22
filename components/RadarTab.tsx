"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LMap, TileLayer } from "leaflet";
import { rainColor, type RainGrid } from "@/lib/grid";
import type { Place } from "@/lib/types";
import { PauseIcon, PlayIcon } from "./Icons";
import { Mascot } from "./Mascot";

interface RadarFrame {
  time: number;
  path: string;
}

/** One step on the timeline: a real radar image from the past, or a forecast hour ahead. */
type Frame = { kind: "radar"; time: number; path: string } | { kind: "forecast"; hour: number; label: string };

const RADAR_MS = 600;
const FORECAST_MS = 1100;

function hourLabel(iso: string): string {
  return `${Number(iso.slice(11, 13))}:00 น.`;
}

export function RadarTab({ place }: { place: Place }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const radarLayers = useRef<TileLayer[]>([]);
  const forecastLayers = useRef<LayerGroup[]>([]);
  const [radar, setRadar] = useState<RadarFrame[]>([]);
  const [host, setHost] = useState("");
  const [grid, setGrid] = useState<RainGrid | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Layers are created asynchronously after `ready`; this re-runs the frame effect then.
  const [mapReady, setMapReady] = useState(false);

  // Past radar (RainViewer) and the forecast grid load in parallel; either alone is still useful.
  useEffect(() => {
    let cancelled = false;
    const radarReq = fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((d: { host: string; radar: { past: RadarFrame[] } }) => {
        if (cancelled) return;
        setHost(d.host);
        setRadar(d.radar.past.slice(-12));
      });
    const gridReq = fetch(`/api/rain-grid?lat=${place.lat}&lon=${place.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: RainGrid | null) => !cancelled && g?.times?.length && setGrid(g));
    Promise.allSettled([radarReq, gridReq]).then((results) => {
      if (cancelled) return;
      if (results.every((r) => r.status === "rejected")) setFailed(true);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [place.lat, place.lon]);

  const frames: Frame[] = [
    ...radar.map((f) => ({ kind: "radar" as const, time: f.time, path: f.path })),
    ...(grid?.times.map((t, hour) => ({ kind: "forecast" as const, hour, label: t })) ?? []),
  ];
  // "Now" is the newest radar image; the slider starts there.
  const nowIdx = Math.max(0, radar.length - 1);

  useEffect(() => {
    if (ready) setIdx(nowIdx);
  }, [ready, nowIdx]);

  // Build the map once data has arrived.
  useEffect(() => {
    if (!ready || !box.current || mapRef.current) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !box.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([place.lat, place.lon], 9);
      // OSM Humanitarian style: softer than the default OSM look and, unlike Esri or CARTO
      // (which now needs a key), it shows Thai place names. Toned down in CSS (.basemap).
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 12,
        className: "basemap",
        attribution: "© OpenStreetMap, HOT, OSM France",
      }).addTo(map);

      radarLayers.current = radar.map((f) =>
        L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0,
          maxNativeZoom: 7,
          maxZoom: 12,
          zIndex: 5,
        }).addTo(map),
      );

      if (grid) {
        // Forecast cells are drawn in their own pane, blurred in CSS so the ~11 km squares
        // read as soft patches like the radar instead of a blocky grid.
        map.createPane("forecast");
        const pane = map.getPane("forecast");
        if (pane) pane.style.zIndex = "450";
        const renderer = L.svg({ pane: "forecast" });
        const half = grid.step / 2;
        forecastLayers.current = grid.times.map((_, h) =>
          L.layerGroup(
            grid.points.flatMap((p) => {
              const color = rainColor(p.mm[h]);
              if (!color) return [];
              return [
                L.rectangle(
                  [
                    [p.lat - half, p.lon - half],
                    [p.lat + half, p.lon + half],
                  ],
                  {
                    renderer,
                    stroke: false,
                    fillColor: color,
                    // The faintest rain is drawn lighter so a drizzly day does not fog the whole map.
                    fillOpacity: p.mm[h] < 0.5 ? 0.35 : 0.65,
                    interactive: false,
                  },
                ),
              ];
            }),
          ),
        );
      }

      L.circleMarker([place.lat, place.lon], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#d4232a",
        fillOpacity: 1,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      disposed = true;
    };
  }, [ready, radar, host, grid, place.lat, place.lon]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Show only the layer for the current frame.
  useEffect(() => {
    const map = mapRef.current;
    radarLayers.current.forEach((l, i) => l.setOpacity(i === idx ? 0.75 : 0));
    forecastLayers.current.forEach((g, h) => {
      const on = idx === radar.length + h;
      if (on && map && !map.hasLayer(g)) g.addTo(map);
      if (!on && map?.hasLayer(g)) g.remove();
    });
  }, [idx, radar.length, mapReady]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const forecast = frames[idx]?.kind === "forecast";
    const t = setTimeout(() => setIdx((i) => (i + 1) % frames.length), forecast ? FORECAST_MS : RADAR_MS);
    return () => clearTimeout(t);
  }, [playing, idx, frames.length, frames]);

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

  const frame = frames[idx];
  let label = "กำลังโหลดภาพ…";
  let sub = "";
  if (frame?.kind === "radar") {
    const ago = Math.max(0, Math.round((Date.now() / 1000 - frame.time) / 60));
    label = idx === nowIdx ? "ตอนนี้" : `ผ่านมา ${ago} นาที`;
    sub = `ภาพเรดาร์จริง ${new Date(frame.time * 1000).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    })} น.`;
  } else if (frame?.kind === "forecast") {
    label = `อีก ${frame.hour + 1} ชั่วโมง`;
    sub = `พยากรณ์ช่วง ${hourLabel(frame.label)}`;
  }
  const isForecast = frame?.kind === "forecast";
  const nowPct = frames.length > 1 ? (nowIdx / (frames.length - 1)) * 100 : 0;
  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => Math.min(frames.length - 1, Math.max(0, i + d)));
  };

  return (
    <div className="stack">
      <div className="map-wrap">
        <div ref={box} className="map" role="img" aria-label="แผนที่ฝน" />
        <div className={`map-badge ${isForecast ? "ahead" : ""}`}>
          {isForecast ? "พยากรณ์" : "เรดาร์"} · {label}
        </div>
      </div>

      <div className="list">
        <div className="list-row block timeline-box">
          <div className="timeline-head">
            <div>
              <p className="row-title">{label}</p>
              {sub && <p className="row-sub">{sub}</p>}
            </div>
          </div>

          <input
            type="range"
            className="scrub"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
            aria-label="เลื่อนดูเวลา"
            style={{ "--now": `${nowPct}%` } as React.CSSProperties}
            disabled={frames.length === 0}
          />
          <div className="scrub-labels" aria-hidden="true">
            <span>ย้อนหลัง</span>
            <span style={{ left: `${nowPct}%` }} className="scrub-now">
              ตอนนี้
            </span>
            <span>{grid ? `อีก ${grid.times.length} ชม.` : ""}</span>
          </div>

          <div className="player">
            <button type="button" className="step" onClick={() => step(-1)} aria-label="ย้อนไปหนึ่งช่วง" disabled={idx <= 0}>
              ‹
            </button>
            <button
              type="button"
              className="play"
              onClick={() => setPlaying((p) => !p)}
              disabled={frames.length === 0}
              aria-label={playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className="step"
              onClick={() => step(1)}
              aria-label="ไปข้างหน้าหนึ่งช่วง"
              disabled={idx >= frames.length - 1}
            >
              ›
            </button>
          </div>

          <div className="rain-scale" aria-label="สีฝน จากเบาไปหนัก">
            <span>ฝนเบา</span>
            <i aria-hidden="true" />
            <span>ฝนหนัก</span>
          </div>
        </div>

        <div className="list-row">
          <Mascot face="think" size={56} />
          <div className="row-main">
            <p className="row-title">น้องฝนบอกวิธีดู</p>
            <p className="row-sub">
              ด้านซ้ายของแถบเวลาคือเรดาร์จริงย้อนหลัง ด้านขวาคือพยากรณ์ล่วงหน้า {grid?.times.length ?? 6} ชั่วโมง
              ซึ่งหยาบกว่าและอาจคลาดเคลื่อน จุดแดงคือที่ของคุณค่ะ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
