"use client";

import { useEffect, useState } from "react";
import { enablePush, pushSupported, syncDevice } from "@/lib/client/push";
import type { Settings } from "@/lib/client/settings";
import type { Sky } from "@/lib/sky";
import { PlacePicker, ProfileEditor, VolumeEditor } from "./controls";
import { Mascot, type Face, type Prop } from "./Mascot";
import { WeatherScene } from "./WeatherScene";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

const SCENES: Sky[] = ["partly", "sunny", "rain", "cloudy", "storm"];

// น้องฝน introduces each setup step.
const GUIDE: { face: Face; prop: Prop; line: string }[] = [
  { face: "happy", prop: "wave", line: "สวัสดีค่ะ หนูชื่อน้องฝน ขอรู้จักกันหน่อยนะคะ" },
  { face: "happy", prop: "none", line: "บอกหนูหน่อยว่าอยู่ที่ไหน จะได้ดูฝนให้ถูกที่ค่ะ" },
  { face: "happy", prop: "umbrella", line: "ให้หนูเตือนก่อนฝนตกนะคะ" },
  { face: "happy", prop: "wave", line: "ลองฟังเสียงหนูหน่อย ดังพอไหมคะ" },
  { face: "happy", prop: "wave", line: "วางหนูไว้หน้าจอหลัก จะได้เปิดง่ายๆ ค่ะ" },
];

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
    <div className="onboard">
      <div className="dots" aria-label={`ขั้นตอนที่ ${step} จาก ${SCENES.length}`}>
        {SCENES.map((_, i) => (
          <span key={i} className={`dot ${i + 1 === step ? "on" : ""}`} />
        ))}
      </div>
      <div className="onboard-art hero-art">
        <WeatherScene sky={SCENES[step - 1]} />
        <div className="hero-mascot">
          <Mascot face={GUIDE[step - 1].face} prop={GUIDE[step - 1].prop} size={88} />
        </div>
        <p className="say">{GUIDE[step - 1].line}</p>
      </div>

      {step === 1 && (
        <>
          <h2>รู้จักกันหน่อย</h2>
          <p className="lede">น้องฝนจะใช้เรียกและให้คำแนะนำที่เหมาะกับคุณค่ะ</p>
          <ProfileEditor
            value={{ callName: settings.callName, routine: settings.routine }}
            onChange={(p) => update(p)}
          />
          <div className="onboard-actions">
            <button type="button" className="btn primary wide" onClick={next}>
              ถัดไป
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>เลือกสถานที่</h2>
          <p className="lede">ใช้ดูฝนและส่งแจ้งเตือน เลือกที่ที่อยู่เป็นประจำค่ะ</p>
          {settings.place ? (
            <div className="onboard-actions">
              <p className="big" style={{ textAlign: "center" }}>
                เลือกแล้ว: {settings.place.name}
              </p>
              <button type="button" className="btn primary wide" onClick={next}>
                ถัดไป
              </button>
              <button type="button" className="btn wide" onClick={() => update({ place: null })}>
                เลือกใหม่
              </button>
            </div>
          ) : (
            <PlacePicker onPick={(p) => update({ place: p })} />
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h2>แจ้งเตือนฝน</h2>
          <p className="lede">
            เตือนตอนเช้าว่าวันนี้ฝนตกตอนไหน เตือนล่วงหน้า 1-3 ชั่วโมง และก่อนฝนตก 30 นาที ไม่ต้องเปิดแอปค่ะ
          </p>
          {note && (
            <p className="note" role="status" style={{ textAlign: "center" }}>
              {note}
            </p>
          )}
          <div className="onboard-actions">
            {pushSupported() ? (
              <button type="button" className="btn primary wide" onClick={allowNotifications}>
                เปิดแจ้งเตือน
              </button>
            ) : (
              <p className="note" style={{ textAlign: "center" }}>
                เครื่องนี้ยังไม่รองรับการแจ้งเตือนค่ะ
              </p>
            )}
            <button type="button" className="btn wide" onClick={next}>
              ข้ามไปก่อน
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2>เสียงน้องฝน</h2>
          <p className="lede">กด &quot;ลองฟังเสียง&quot; แล้วปรับให้ได้ยินชัด ใช้ตอนฟังคำตอบและตอนโทรคุยกับน้องฝนค่ะ</p>
          <VolumeEditor level={settings.volume} onChange={(volume) => update({ volume })} />
          <p className="note" style={{ textAlign: "center" }}>
            ถ้ายังเบา กดปุ่มเพิ่มเสียงข้างเครื่องด้วยนะคะ เปลี่ยนภายหลังได้ที่หน้าตั้งค่า
          </p>
          <div className="onboard-actions">
            <button type="button" className="btn primary wide" onClick={next}>
              ถัดไป
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <h2>วางไว้บนหน้าจอหลัก</h2>
          <p className="lede">จะได้กดเปิดจากหน้าจอโทรศัพท์ได้เลย เหมือนแอปทั่วไปค่ะ</p>
          {!installEvent && (
            <p className="note" style={{ textAlign: "center" }}>
              กดปุ่มจุดสามจุดมุมขวาบนของ Chrome แล้วเลือก "เพิ่มลงในหน้าจอหลัก" หรือ "ติดตั้งแอป" ค่ะ
            </p>
          )}
          <div className="onboard-actions">
            {installEvent && (
              <button
                type="button"
                className="btn wide"
                onClick={async () => {
                  await installEvent.prompt();
                  setInstallEvent(null);
                }}
              >
                ติดตั้งแอปเช็คฝน
              </button>
            )}
            <button type="button" className="btn primary wide" onClick={() => update({ setupDone: true })}>
              เสร็จแล้ว เริ่มใช้งาน
            </button>
          </div>
        </>
      )}
    </div>
  );
}
