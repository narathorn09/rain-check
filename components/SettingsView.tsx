"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, pushSupported, sendTest, syncDevice } from "@/lib/client/push";
import type { Settings } from "@/lib/client/settings";
import { MorningTimeEditor, PlacePicker, Switch } from "./controls";

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
    setNote((await sendTest(settings.deviceId)) ? "ส่งข้อความทดสอบแล้ว รอสักครู่นะคะ" : "ส่งไม่สำเร็จ ลองเปิดแจ้งเตือนใหม่อีกครั้งค่ะ");
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h2>ตั้งค่า</h2>
        <button type="button" className="btn" onClick={onClose}>
          กลับ
        </button>
      </div>

      <section className="card stack">
        <h3>สถานที่ของฉัน</h3>
        <p className="big">{settings.place ? settings.place.name : "ยังไม่ได้เลือก"}</p>
        {changing ? (
          <PlacePicker
            onPick={(p) => {
              update({ place: p });
              setChanging(false);
            }}
          />
        ) : (
          <button type="button" className="btn wide" onClick={() => setChanging(true)}>
            เปลี่ยนสถานที่
          </button>
        )}
      </section>

      <section className="card stack">
        <h3>แจ้งเตือน</h3>
        {perm === "granted" ? (
          <>
            <Switch
              checked={settings.morning}
              onChange={(v) => update({ morning: v })}
              title="สรุปฝนตอนเช้า"
              hint="บอกว่าวันนี้ฝนตกตอนไหน"
            />
            {settings.morning && <MorningTimeEditor minutes={settings.morningMinutes} onChange={(m) => update({ morningMinutes: m })} />}
            <Switch
              checked={settings.alert}
              onChange={(v) => update({ alert: v })}
              title="เตือนก่อนฝนตก"
              hint="เตือนเมื่อฝนจะตกใน 30 นาที (ตั้งแต่ตี 5 ถึง 3 ทุ่ม)"
            />
            <button type="button" className="btn wide" onClick={test}>
              ส่งข้อความทดสอบ
            </button>
            <button
              type="button"
              className="btn wide"
              onClick={async () => {
                await disablePush(settings.deviceId);
                setPerm("default");
                setNote("ปิดการแจ้งเตือนในแอปนี้แล้วค่ะ");
              }}
            >
              ปิดการแจ้งเตือนทั้งหมด
            </button>
          </>
        ) : perm === "unsupported" ? (
          <p className="note">เครื่องหรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนค่ะ</p>
        ) : (
          <button type="button" className="btn primary wide" onClick={turnOn}>
            เปิดการแจ้งเตือน
          </button>
        )}
        {note && <p className="note" role="status">{note}</p>}
      </section>
    </div>
  );
}
