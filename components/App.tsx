"use client";

import { useEffect, useMemo, useState } from "react";
import { geoAlreadyGranted, getPosition, placeName } from "@/lib/client/geo";
import { registerWorker, syncDevice } from "@/lib/client/push";
import { useSettings } from "@/lib/client/settings";
import type { Place } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Mascot } from "./Mascot";
import { ChatTab } from "./ChatTab";
import { ChatIcon, GearIcon, MapIcon, PinIcon, UmbrellaIcon } from "./Icons";
import { RadarTab } from "./RadarTab";
import { RainTab } from "./RainTab";
import { SettingsView } from "./SettingsView";
import { Wizard } from "./Wizard";

type Tab = "rain" | "radar" | "chat";

const TABS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: "rain", label: "ฝน", Icon: UmbrellaIcon },
  { id: "radar", label: "เรดาร์", Icon: MapIcon },
  { id: "chat", label: "ถามน้องฝน", Icon: ChatIcon },
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
        if (cancelled) return;
        // Show the forecast right away; the name arrives a moment later.
        setGps({ name: "ตำแหน่งตอนนี้", lat: fix.lat, lon: fix.lon });
        const name = await placeName(fix.lat, fix.lon);
        if (name && !cancelled) setGps({ name, lat: fix.lat, lon: fix.lon });
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

  if (!settings) {
    return (
      <main className="shell">
        <div className="splash">
          <Mascot face="happy" prop="wave" size={120} />
          <p className="big">กำลังเปิดเช็คฝน…</p>
        </div>
      </main>
    );
  }

  if (!settings.setupDone || !place) {
    return (
      <main className="shell">
        <header className="appbar">
          <div className="appbar-main">
            <h1>เช็คฝน</h1>
          </div>
        </header>
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

  const isHere = Boolean(useGps && gps);
  const placeLine = (
    <p className="appbar-sub">
      <span className="place-name">
        <PinIcon />
        {place.name}
        {isHere && <span className="here-tag">ตำแหน่งตอนนี้</span>}
      </span>
      {gps && (
        <button type="button" className="link" onClick={() => setUseGps((v) => !v)}>
          {useGps ? "ดูที่สถานที่ของฉัน" : "ดูที่ตำแหน่งตอนนี้"}
        </button>
      )}
    </p>
  );

  return (
    <main className={`shell ${tab === "chat" ? "chat-mode" : ""}`}>
      <header className="appbar">
        <div className="appbar-main">
          {tab === "chat" ? (
            <>
              <Avatar />
              <div>
                <h1>น้องฝน</h1>
                <p className="appbar-sub">ผู้ช่วยเรื่องฝน · {place.name}</p>
              </div>
            </>
          ) : (
            <div>
              <h1>{tab === "radar" ? "เรดาร์ฝน" : "เช็คฝน"}</h1>
              {placeLine}
            </div>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={() => setShowSettings(true)}>
          <GearIcon />
          ตั้งค่า
        </button>
      </header>

      <section className="content">
        {tab === "rain" && <RainTab place={place} here={isHere} nowTick={tick} />}
        {tab === "radar" && <RadarTab place={place} />}
        {tab === "chat" && (
          <ChatTab place={place} profile={{ callName: settings.callName, routine: settings.routine }} />
        )}
      </section>

      <nav className="tabs" aria-label="เมนูหลัก">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} aria-current={tab === id} onClick={() => setTab(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
