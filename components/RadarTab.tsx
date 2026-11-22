"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { ImageOverlay, Map as LMap, TileLayer } from "leaflet";
import { renderField, type RainGrid } from "@/lib/grid";
import type { Place } from "@/lib/types";
import { PauseIcon, PlayIcon } from "./Icons";
import { Mascot } from "./Mascot";

interface RadarFrame {
  time: number;
  path: string;
}

/** One step on the timeline: a real radar image from the past, or a forecast hour ahead. */
type Frame = { kind: "radar"; time: number; path: string } | { kind: "forecast"; hour: number; label: string };

// Radar frames are 10 minutes apart and forecast frames an hour apart, so forecast frames
// stay on screen longer. Layers cross-fade (CSS) for a smooth, Windy-like animation.
const RADAR_MS = 700;
const FORECAST_MS = 1200;
// Pause on "now" each loop, so the present moment is easy to catch.
const NOW_PAUSE_MS = 1500;

const BKK_TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" };

function clockOf(frame: Frame): string {
  if (frame.kind === "radar") return new Date(frame.time * 1000).toLocaleTimeString("th-TH", BKK_TIME);
  return `${frame.label.slice(11, 13)}:00`;
}

function fieldImage(grid: RainGrid, hour: number): string {
  const { width, data } = renderField(grid, hour);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(data), width, width), 0, 0);
  return canvas.toDataURL();
}

export function RadarTab({ place }: { place: Place }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const radarLayers = useRef<TileLayer[]>([]);
  const fieldLayers = useRef<ImageOverlay[]>([]);
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
      const map = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([place.lat, place.lon], 9);
      L.control.zoom({ position: "topright" }).addTo(map);
      // OSM Humanitarian style: unlike Esri or CARTO (which now needs a key), it shows Thai
      // place names. Muted to grey in CSS (.basemap) so the rain colours stand out, as on Windy.
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 12,
        className: "basemap",
        attribution: "© OpenStreetMap, HOT, OSM France · RainViewer · Open-Meteo",
      }).addTo(map);

      radarLayers.current = radar.map((f) =>
        L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0,
          maxNativeZoom: 7,
          maxZoom: 12,
          zIndex: 5,
          className: "rain-layer",
        }).addTo(map),
      );

      if (grid) {
        // Each forecast hour becomes one smooth image: rain blended between grid points
        // instead of ~11 km squares.
        const size = Math.round(Math.sqrt(grid.points.length));
        const half = grid.step / 2;
        const north = Math.max(...grid.points.map((p) => p.lat)) + half;
        const west = Math.min(...grid.points.map((p) => p.lon)) - half;
        const bounds = L.latLngBounds([north - size * grid.step, west], [north, west + size * grid.step]);
        fieldLayers.current = grid.times.map((_, h) =>
          L.imageOverlay(fieldImage(grid, h), bounds, { opacity: 0, className: "rain-layer field", zIndex: 6 }).addTo(map),
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

  // Show only the current frame; the CSS opacity transition turns the swap into a cross-fade.
  useEffect(() => {
    radarLayers.current.forEach((l, i) => l.setOpacity(i === idx ? 0.8 : 0));
    fieldLayers.current.forEach((l, h) => l.setOpacity(idx === radar.length + h ? 1 : 0));
  }, [idx, radar.length, mapReady]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const forecast = frames[idx]?.kind === "forecast";
    const wait = idx === nowIdx ? NOW_PAUSE_MS : forecast ? FORECAST_MS : RADAR_MS;
    const t = setTimeout(() => setIdx((i) => (i + 1) % frames.length), wait);
    return () => clearTimeout(t);
  }, [playing, idx, frames.length, frames, nowIdx]);

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
  // Track positions: a forecast hour gets twice the room of a 10-minute radar step, so the
  // future is not squeezed into the last third and its labels do not overlap.
  const steps: number[] = frames.map((f, i) => (i === 0 ? 0 : f.kind === "forecast" ? 2 : 1));
  const cum = steps.map((_, i) => steps.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const total = Math.max(1, cum[cum.length - 1] ?? 1);
  const pct = (i: number) => ((cum[i] ?? 0) / total) * 100;
  const nearest = (p: number) => {
    let best = 0;
    for (let i = 1; i < frames.length; i++) if (Math.abs(pct(i) - p) < Math.abs(pct(best) - p)) best = i;
    return best;
  };
  const goTo = (i: number) => {
    setPlaying(false);
    setIdx(Math.min(frames.length - 1, Math.max(0, i)));
  };
  let when = "กำลังโหลด…";
  if (frame?.kind === "radar") {
    const ago = Math.max(0, Math.round((Date.now() / 1000 - frame.time) / 60));
    when = idx === nowIdx ? "ตอนนี้" : `${ago} นาทีที่แล้ว`;
  } else if (frame?.kind === "forecast") {
    when = `อีก ${frame.hour + 1} ชม.`;
  }
  const isForecast = frame?.kind === "forecast";

  // Labels under the track: start of the radar, "now", then every other forecast hour.
  const ticks: { i: number; text: string; now?: boolean }[] = [];
  if (radar.length > 1) ticks.push({ i: 0, text: clockOf(frames[0]) });
  if (frames.length) ticks.push({ i: nowIdx, text: "ตอนนี้", now: true });
  grid?.times.forEach((_, h) => {
    if ((h + 1) % 3 === 0) ticks.push({ i: radar.length + h, text: `+${h + 1} ชม.` });
  });

  return (
    <div className="stack">
      <div className="map-wrap windy">
        <div ref={box} className="map" role="img" aria-label="แผนที่ฝน" />

        <div className={`map-time ${isForecast ? "ahead" : ""}`} aria-live="polite">
          <span className="map-time-clock">{frame ? `${clockOf(frame)} น.` : "--:--"}</span>
          <span className="map-time-when">
            {isForecast ? "พยากรณ์" : "เรดาร์"} · {when}
          </span>
        </div>

        <div className="map-legend" aria-label="สีฝน จากเบาไปหนัก">
          <i aria-hidden="true" />
          <div>
            <span>เบา</span>
            <span>ปานกลาง</span>
            <span>หนัก</span>
          </div>
        </div>

        <div className="map-player">
          <button
            type="button"
            className="play"
            onClick={() => setPlaying((p) => !p)}
            disabled={frames.length === 0}
            aria-label={playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <div className="track-wrap">
            <div className="track" style={{ "--now": `${pct(nowIdx)}%`, "--at": `${pct(idx)}%` } as React.CSSProperties}>
              {frames.map((_, i) => (
                <span key={i} className="track-dot" style={{ left: `${pct(i)}%` }} />
              ))}
              {frame && (
                <span className="track-bubble" style={{ left: `${pct(idx)}%` }}>
                  {clockOf(frame)}
                </span>
              )}
            </div>
            <input
              type="range"
              className="track-input"
              // The slider runs 0-1000 so a drag lands where the finger is on the uneven track.
              min={0}
              max={1000}
              value={Math.round(pct(idx) * 10)}
              onChange={(e) => goTo(nearest(Number(e.target.value) / 10))}
              onKeyDown={(e) => {
                const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                goTo(idx + d);
              }}
              aria-label="เลื่อนดูเวลา"
              aria-valuetext={frame ? `${clockOf(frame)} น. ${when}` : undefined}
              disabled={frames.length === 0}
            />
            <div className="track-ticks" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t.i} className={t.now ? "now" : ""} style={{ left: `${pct(t.i)}%` }}>
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="list">
        <div className="list-row">
          <Mascot face="think" size={56} />
          <div className="row-main">
            <p className="row-title">น้องฝนบอกวิธีดู</p>
            <p className="row-sub">
              กดปุ่มเล่นหรือเลื่อนแถบเวลา ก่อน &quot;ตอนนี้&quot; คือเรดาร์จริงย้อนหลัง หลังจากนั้นคือพยากรณ์ล่วงหน้า{" "}
              {grid?.times.length ?? 6} ชั่วโมง ซึ่งอาจคลาดเคลื่อน จุดแดงคือที่ของคุณค่ะ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
