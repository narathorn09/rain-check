"use client";

import { useEffect, useState } from "react";
import {
  disablePush,
  enablePush,
  localTestNotification,
  pushSupported,
  sendTest,
  syncDevice,
  type LocalTestResult,
} from "@/lib/client/push";
import type { Settings } from "@/lib/client/settings";
import { MorningTimeEditor, PlacePicker, SwitchRow } from "./controls";
import { BackIcon, BellIcon, ChevronIcon, PinIcon, UmbrellaIcon } from "./Icons";

type Perm = "granted" | "denied" | "default" | "unsupported";

export function SettingsView({
  settings,
  update,
  onClose,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const [perm, setPerm] = useState<Perm>("default");
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setPerm(pushSupported() ? Notification.permission : "unsupported");
  }, []);

  // Sync after every change so the server always matches this screen.
  useEffect(() => {
    syncDevice(settings).catch(() => {});
  }, [settings]);

  async function turnOn() {
    const r = await enablePush();
    setPerm(pushSupported() ? Notification.permission : "unsupported");
    if (r === "ok") {
      await syncDevice(settings);
      setNote("เปิดแจ้งเตือนแล้วค่ะ");
    } else if (r === "denied") {
      setNote("ยังไม่ได้อนุญาตแจ้งเตือน เปิดได้ที่ ตั้งค่าเครื่อง > แอป > Chrome > การแจ้งเตือน ค่ะ");
    } else {
      setNote("เครื่องนี้ยังใช้แจ้งเตือนไม่ได้ค่ะ");
    }
  }

  async function test() {
    setNote(
      (await sendTest(settings.deviceId))
        ? "ส่งจากเซิร์ฟเวอร์แล้ว ถ้าไม่เด้งภายใน 1 นาที ลองกด \"ทดสอบบนเครื่องนี้\" ค่ะ"
        : "ส่งไม่สำเร็จ ลองเปิดแจ้งเตือนใหม่อีกครั้งค่ะ",
    );
  }

  async function testHere() {
    const r = await localTestNotification();
    const notes: Record<LocalTestResult, string> = {
      ok: "แสดงแจ้งเตือนบนเครื่องแล้ว ถ้ามองไม่เห็น แปลว่าตั้งค่าของมือถือปิดแจ้งเตือนไว้ ไปที่ ตั้งค่าเครื่อง > แอป > Chrome (หรือ เช็คฝน) > การแจ้งเตือน แล้วเปิดค่ะ",
      "no-permission": "ยังไม่ได้อนุญาตแจ้งเตือน กด \"เปิดการแจ้งเตือน\" ก่อนค่ะ",
      unsupported: "เครื่องหรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนค่ะ",
      error: "แสดงแจ้งเตือนไม่ได้ ลองปิดแอปแล้วเปิดใหม่อีกครั้งค่ะ",
    };
    setNote(notes[r]);
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="กลับ">
          <BackIcon />
        </button>
        <div className="appbar-main">
          <h1>ตั้งค่า</h1>
        </div>
      </header>

      <p className="section-label">สถานที่</p>
      <div className="list">
        <button type="button" className="list-row" onClick={() => setChanging((v) => !v)} aria-expanded={changing}>
          <span className="lead">
            <PinIcon />
          </span>
          <span className="row-main">
            <span className="row-title" style={{ display: "block" }}>สถานที่ของฉัน</span>
            <span className="row-sub" style={{ display: "block" }}>{settings.place ? settings.place.name : "ยังไม่ได้เลือก"}</span>
          </span>
          <span className="trail">
            เปลี่ยน <ChevronIcon />
          </span>
        </button>
        {changing && (
          <div className="list-row block">
            <PlacePicker
              onPick={(p) => {
                update({ place: p });
                setChanging(false);
              }}
            />
          </div>
        )}
      </div>

      <p className="section-label">การแจ้งเตือน</p>
      <div className="list">
        {perm === "granted" ? (
          <>
            <SwitchRow
              icon={<BellIcon />}
              checked={settings.morning}
              onChange={(v) => update({ morning: v })}
              title="สรุปฝนตอนเช้า"
              hint="บอกว่าวันนี้ฝนตกตอนไหน"
            />
            {settings.morning && (
              <div className="list-row block">
                <MorningTimeEditor minutes={settings.morningMinutes} onChange={(m) => update({ morningMinutes: m })} />
              </div>
            )}
            <SwitchRow
              icon={<UmbrellaIcon />}
              checked={settings.alert}
              onChange={(v) => update({ alert: v })}
              title="เตือนก่อนฝนตก"
              hint="เตือนล่วงหน้า 1-3 ชั่วโมง และอีกครั้งก่อนตก 30 นาที (ตี 5 ถึง 3 ทุ่ม)"
            />
            <button type="button" className="list-row" onClick={testHere}>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>ทดสอบบนเครื่องนี้</span>
                <span className="row-sub" style={{ display: "block" }}>มือถือแสดงแจ้งเตือนเอง ไม่ผ่านอินเทอร์เน็ต</span>
              </span>
              <span className="trail">
                <ChevronIcon />
              </span>
            </button>
            <button type="button" className="list-row" onClick={test}>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>ทดสอบผ่านเซิร์ฟเวอร์</span>
                <span className="row-sub" style={{ display: "block" }}>เหมือนแจ้งเตือนฝนจริง</span>
              </span>
              <span className="trail">
                <ChevronIcon />
              </span>
            </button>
            <button
              type="button"
              className="list-row danger"
              onClick={async () => {
                await disablePush(settings.deviceId);
                setPerm("default");
                setNote("ปิดการแจ้งเตือนในแอปนี้แล้วค่ะ");
              }}
            >
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>ปิดการแจ้งเตือนทั้งหมด</span>
              </span>
            </button>
          </>
        ) : perm === "unsupported" ? (
          <div className="list-row">
            <p className="note">เครื่องหรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนค่ะ</p>
          </div>
        ) : (
          <div className="list-row block">
            <button type="button" className="btn primary wide" onClick={turnOn}>
              เปิดการแจ้งเตือน
            </button>
          </div>
        )}
      </div>
      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}
    </>
  );
}
