"use client";

import { useEffect, useState } from "react";
import { enablePush, pushSupported, syncDevice } from "@/lib/client/push";
import type { Settings } from "@/lib/client/settings";
import { PlacePicker, WindowEditor } from "./controls";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

const STEPS = 4;

/** One-time setup, meant to be done by a family member on the user's phone. */
export function Wizard({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [step, setStep] = useState(1);
  const [note, setNote] = useState("");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const next = () => {
    setNote("");
    setStep((s) => s + 1);
  };

  async function allowNotifications() {
    const r = await enablePush();
    if (r === "ok") {
      await syncDevice(settings);
      next();
    } else if (r === "denied") {
      setNote("ยังไม่ได้กดอนุญาต กดปุ่มอีกครั้งแล้วเลือก \"อนุญาต\" ค่ะ หรือข้ามไปก่อนก็ได้");
    } else {
      setNote("เครื่องนี้ยังใช้แจ้งเตือนไม่ได้ ข้ามไปก่อนได้ค่ะ");
    }
  }

  return (
    <div className="sheet wizard">
      <p className="step-count">ขั้นตอนที่ {step} จาก {STEPS}</p>

      {step === 1 && (
        <section className="card stack">
          <h2>1. เลือกจุดขายของ</h2>
          <p className="note">ใช้ดูฝนและส่งแจ้งเตือน เลือกที่ที่ขายของเป็นประจำค่ะ</p>
          {settings.sellSpot ? (
            <>
              <p className="big">เลือกแล้ว: {settings.sellSpot.name}</p>
              <button type="button" className="btn primary wide" onClick={next}>
                ถัดไป
              </button>
              <button type="button" className="btn wide" onClick={() => update({ sellSpot: null })}>
                เลือกใหม่
              </button>
            </>
          ) : (
            <PlacePicker onPick={(p) => update({ sellSpot: p })} />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card stack">
          <h2>2. ช่วงเวลาขายของ</h2>
          <p className="note">แอปจะบอกเฉพาะฝนในช่วงเวลานี้ค่ะ</p>
          <WindowEditor value={settings.window} onChange={(w) => update({ window: w })} />
          <button type="button" className="btn primary wide" onClick={next}>
            ถัดไป
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="card stack">
          <h2>3. แจ้งเตือนฝน</h2>
          <p className="note">เตือนตอนเช้าว่าวันนี้ฝนตกตอนไหน และเตือนก่อนฝนจะตก ไม่ต้องเปิดแอปค่ะ</p>
          {pushSupported() ? (
            <button type="button" className="btn primary wide" onClick={allowNotifications}>
              เปิดแจ้งเตือน
            </button>
          ) : (
            <p className="note">เครื่องนี้ยังไม่รองรับการแจ้งเตือนค่ะ</p>
          )}
          {note && <p className="note" role="status">{note}</p>}
          <button type="button" className="btn wide" onClick={next}>
            ข้ามไปก่อน
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="card stack">
          <h2>4. วางไว้บนหน้าจอหลัก</h2>
          <p className="note">จะได้กดเปิดจากหน้าจอโทรศัพท์ได้เลย เหมือนแอปทั่วไปค่ะ</p>
          {installEvent ? (
            <button
              type="button"
              className="btn primary wide"
              onClick={async () => {
                await installEvent.prompt();
                setInstallEvent(null);
              }}
            >
              ติดตั้งแอปเช็คฝน
            </button>
          ) : (
            <p className="note">
              กดปุ่มจุดสามจุดมุมขวาบนของ Chrome แล้วเลือก "เพิ่มลงในหน้าจอหลัก" หรือ "ติดตั้งแอป" ค่ะ
            </p>
          )}
          <button type="button" className="btn primary wide" onClick={() => update({ setupDone: true })}>
            เสร็จแล้ว เริ่มใช้งาน
          </button>
        </section>
      )}
    </div>
  );
}
