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
  type ServerTestResult,
} from "@/lib/client/push";
import type { Settings } from "@/lib/client/settings";
import { MorningTimeEditor, PlacePicker, ProfileEditor, SwitchRow } from "./controls";
import { BackIcon, BellIcon, ChevronIcon, PinIcon, UmbrellaIcon } from "./Icons";
import { Mascot } from "./Mascot";

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
  const [editingProfile, setEditingProfile] = useState(false);
  const [note, setNote] = useState("");
  const [swVersion, setSwVersion] = useState("");
  const [receipt, setReceipt] = useState<{ count: number; at: number; error?: string } | null>(null);

  useEffect(() => {
    setPerm(pushSupported() ? Notification.permission : "unsupported");
  }, []);

  // Receipts from the service worker prove whether a push reached this phone, which tells
  // "not delivered" apart from "delivered but shown silently".
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { source?: string; type?: string; version?: string; at?: number; error?: string };
      if (m?.source !== "rain-check-sw") return;
      if (m.version) setSwVersion(m.version);
      if (m.type === "push-shown" || m.type === "push-failed") {
        setReceipt((r) => ({ count: (r?.count ?? 0) + 1, at: m.at ?? Date.now(), error: m.error }));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage("version?")).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
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
    const notes: Record<ServerTestResult, string> = {
      ok: "ส่งจากเซิร์ฟเวอร์แล้ว ถ้าไม่เด้งภายใน 1 นาที ลองกด \"ทดสอบบนเครื่องนี้\" ค่ะ",
      "not-registered":
        "เซิร์ฟเวอร์ยังจำเครื่องนี้ไม่ได้ ลองกด \"ปิดการแจ้งเตือนทั้งหมด\" แล้วเปิดใหม่อีกครั้งค่ะ",
      "push-failed": "บริการแจ้งเตือนส่งไม่สำเร็จ ลองปิดแล้วเปิดการแจ้งเตือนใหม่อีกครั้งค่ะ",
    };
    setNote(notes[await sendTest(settings)]);
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

      <div className="list">
        <div className="mascot-banner">
          <Mascot face="happy" prop="wave" size={64} />
          <p>ตั้งค่าตรงนี้ แล้วน้องฝนจะคอยเตือนเรื่องฝนให้นะคะ</p>
        </div>
      </div>

      <p className="section-label">น้องฝนคุยกับใคร</p>
      <div className="list">
        <button type="button" className="list-row" onClick={() => setEditingProfile((v) => !v)} aria-expanded={editingProfile}>
          <span className="lead">
            <Mascot size={34} still />
          </span>
          <span className="row-main">
            <span className="row-title" style={{ display: "block" }}>
              เรียกว่า {settings.callName || "(ไม่ระบุชื่อ)"}
            </span>
            <span className="row-sub" style={{ display: "block" }}>{settings.routine || "ไม่ระบุว่าทำอะไรประจำ"}</span>
          </span>
          <span className="trail">
            {editingProfile ? "เสร็จ" : "แก้ไข"} <ChevronIcon />
          </span>
        </button>
        {editingProfile && (
          <div className="list-row block">
            <ProfileEditor
              value={{ callName: settings.callName, routine: settings.routine }}
              onChange={(p) => update(p)}
            />
            <p className="note" style={{ marginTop: 12 }}>
              น้องฝนจะใช้ชื่อนี้ทักทาย ตอบคำถาม และในแจ้งเตือนตอนเช้า เปลี่ยนได้ตลอดเวลาค่ะ
            </p>
          </div>
        )}
      </div>

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
      {receipt && (
        <div className={`receipt ${receipt.error ? "bad" : ""}`} role="status">
          {receipt.error ? (
            <p>
              เครื่องได้รับข้อความแล้ว แต่แสดงแจ้งเตือนไม่ได้: {receipt.error}
            </p>
          ) : (
            <>
              <p>
                ✓ เครื่องได้รับแจ้งเตือนแล้ว เวลา{" "}
                {new Date(receipt.at).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} (ครั้งที่ {receipt.count})
              </p>
              <p className="note">
                ถ้าได้รับแต่ไม่เห็นเด้งหรือไม่มีเสียง แปลว่ามือถือตั้งแจ้งเตือนของเว็บนี้เป็นแบบเงียบ ไปที่ ตั้งค่าเครื่อง &gt;
                แอป &gt; Chrome (หรือ เช็คฝน) &gt; การแจ้งเตือน แล้วเลือกหมวดของ rain-check-snowy.vercel.app ให้เป็น
                &quot;มีเสียง/แจ้งเตือน&quot; และเปิด &quot;แสดงบนหน้าจอ&quot; ค่ะ
              </p>
            </>
          )}
        </div>
      )}
      {swVersion && <p className="note">ตัวจัดการแจ้งเตือนเวอร์ชัน {swVersion}</p>}
    </>
  );
}
