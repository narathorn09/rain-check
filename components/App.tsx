"use client";

import { useEffect, useMemo, useState } from "react";
import { geoAlreadyGranted, getPosition } from "@/lib/client/geo";
import { registerWorker, syncDevice } from "@/lib/client/push";
import { useSettings } from "@/lib/client/settings";
import type { Place } from "@/lib/types";
import { ChatTab } from "./ChatTab";
import { RadarTab } from "./RadarTab";
import { RainTab } from "./RainTab";
import { SettingsView } from "./SettingsView";
import { Wizard } from "./Wizard";

type Tab = "rain" | "radar" | "chat";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "rain", label: "ฝน", icon: "🌧️" },
  { id: "radar", label: "เรดาร์", icon: "🗺️" },
  { id: "chat", label: "ถามน้องฝน", icon: "💬" },
];

const REFRESH_MS = 5 * 60 * 1000;

export function App() {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>("rain");
  const [showSettings, setShowSettings] = useState(false);
  const [gps, setGps] = useState<Place | null>(null);
  const [useGps, setUseGps] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    registerWorker();
  }, []);

  // Re-sync with the server on every launch so a rotated subscription is not lost.
  useEffect(() => {
    if (settings?.setupDone) syncDevice(settings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.setupDone]);

  useEffect(() => {
    if (!settings?.setupDone) return;
    let cancelled = false;
    geoAlreadyGranted().then(async (ok) => {
      if (!ok || cancelled) return;
      try {
        const fix = await getPosition();
        if (!cancelled) setGps({ name: "ตำแหน่งตอนนี้", lat: fix.lat, lon: fix.lon });
      } catch {
        // Falls back to the saved place.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settings?.setupDone]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && setTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const place = useMemo<Place | null>(() => {
    if (!settings?.place) return null;
    return useGps && gps ? gps : settings.place;
  }, [settings?.place, gps, useGps]);

  if (!settings) return <main className="shell"><p className="big center">กำลังเปิดเช็คฝน…</p></main>;

  if (!settings.setupDone || !place) {
    return (
      <main className="shell">
        <header className="top"><h1>เช็คฝน</h1></header>
        <Wizard settings={settings} update={update} />
      </main>
    );
  }

  if (showSettings) {
    return (
      <main className="shell">
        <SettingsView settings={settings} update={update} onClose={() => setShowSettings(false)} />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>เช็คฝน</h1>
          <p className="place">
            {place.name}
            {gps && (
              <button type="button" className="link" onClick={() => setUseGps((v) => !v)}>
                {useGps ? "ดูที่สถานที่ของฉัน" : "ดูที่ตำแหน่งตอนนี้"}
              </button>
            )}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setShowSettings(true)} aria-label="ตั้งค่า">
          ตั้งค่า
        </button>
      </header>

      <section className="content">
        {tab === "rain" && <RainTab place={place} nowTick={tick} />}
        {tab === "radar" && <RadarTab place={place} />}
        {tab === "chat" && <ChatTab place={place} />}
      </section>

      <nav className="tabs" aria-label="เมนูหลัก">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "on" : ""} aria-current={tab === t.id} onClick={() => setTab(t.id)}>
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
