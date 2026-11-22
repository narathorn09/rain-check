"use client";

import { useEffect, useRef, useState } from "react";
import { PcmTimeline, STREAM_RATE, primeAudio, stopPcm } from "@/lib/client/pcmPlayer";
import { pcmToWav } from "@/lib/wav";

// One sentence of น้องฝน's real voice, fetched once and replayed through each path.
const SAMPLE_TEXT = "สวัสดีค่ะ น้องฝนกำลังทดสอบเสียงอยู่นะคะ วันนี้อากาศดี ไม่มีฝนค่ะ";

type Path = "tone" | "native" | "app" | "plain";

const PATHS: { id: Path; label: string; detail: string }[] = [
  { id: "tone", label: "A. เสียงหึ่งทดสอบ", detail: "เสียงสังเคราะห์ล้วน ผ่านตัวเล่นของแอป" },
  { id: "native", label: "B. เสียงน้องฝน (ตัวเล่นมาตรฐาน)", detail: "ไม่ผ่านตัวเล่นของแอปเลย" },
  { id: "app", label: "C. เสียงน้องฝน (ตัวเล่นของแอป)", detail: "แบบเดียวกับตอนอ่านคำตอบและตอนโทร" },
  { id: "plain", label: "D. เสียงน้องฝน (Web Audio พื้นฐาน)", detail: "ไม่ผ่านตัวกรองและตัวกำจัดคลิก" },
];

/** 3 s of a soft 440 Hz tone as 16-bit PCM, to test playback without any speech. */
function toneBytes(): Uint8Array {
  const n = STREAM_RATE * 3;
  const bytes = new Uint8Array(n * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 2400, (n - i) / 2400);
    view.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / STREAM_RATE) * 9000 * fade), true);
  }
  return bytes;
}

/**
 * Plays the same audio through different paths so a crackle can be pinned down on the
 * phone itself: the source (B and C both crackle), the app's player (only C), or the
 * filters and de-clicker (C crackles, D does not).
 */
export function SoundTest() {
  const [voice, setVoice] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState("");
  const [playing, setPlaying] = useState<Path | null>(null);
  const [info, setInfo] = useState("");
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const plainSrc = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Load the sample now, so each tap can start playback at once: a phone may refuse
    // to start audio that begins after a network wait instead of during the tap.
    loadVoice();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    stopPcm();
    audioEl.current?.pause();
    audioEl.current = null;
    try {
      plainSrc.current?.stop();
    } catch {
      // Already stopped.
    }
    plainSrc.current = null;
    setPlaying(null);
  }

  async function loadVoice(): Promise<Uint8Array | null> {
    if (voice) return voice;
    setStatus("กำลังโหลดเสียงน้องฝน…");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: SAMPLE_TEXT }),
      });
      if (!res.ok) throw new Error();
      const bytes = new Uint8Array(await res.arrayBuffer());
      setVoice(bytes);
      setStatus("");
      return bytes;
    } catch {
      setStatus("โหลดเสียงน้องฝนไม่ได้ ลองใหม่อีกครั้งค่ะ");
      return null;
    }
  }

  async function play(path: Path) {
    stopAll();
    // Unlock audio during the tap, before any await.
    const ctx = primeAudio();
    if (ctx) setInfo(`อัตราเสียงของเครื่อง ${ctx.sampleRate} Hz · หน่วง ${Math.round((ctx.baseLatency ?? 0) * 1000)} ms`);
    setPlaying(path);
    const done = () => setPlaying((p) => (p === path ? null : p));

    if (path === "tone") {
      const t = new PcmTimeline(STREAM_RATE, () => false);
      t.appendPcm(toneBytes());
      t.whenDone(done);
      return;
    }

    const bytes = await loadVoice();
    if (!bytes) return done();

    if (path === "native") {
      const wav = pcmToWav(bytes, STREAM_RATE);
      const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }));
      const el = new Audio(url);
      audioEl.current = el;
      el.onended = () => {
        URL.revokeObjectURL(url);
        done();
      };
      el.play().catch(done);
      return;
    }

    if (path === "app") {
      const t = new PcmTimeline(STREAM_RATE, () => false);
      t.appendPcm(bytes);
      t.whenDone(done);
      return;
    }

    // Plain Web Audio: one buffer straight to the speaker, nothing in between.
    if (!ctx) return done();
    const n = Math.floor(bytes.length / 2);
    const buf = ctx.createBuffer(1, n, STREAM_RATE);
    const ch = buf.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
    for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = done;
    plainSrc.current = src;
    src.start();
  }

  return (
    <div className="stack">
      <p className="note">
        กดฟังทีละปุ่ม แล้วจดว่าปุ่มไหนมีเสียงแตก ส่งผลให้คนดูแลแอปได้เลยค่ะ (ใช้เสียงลำโพงปกติ ไม่ต้องเสียบหูฟัง)
      </p>
      {PATHS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`btn wide sound-test ${playing === p.id ? "primary" : ""}`}
          onClick={() => (playing === p.id ? stopAll() : play(p.id))}
        >
          <span className="row-title" style={{ display: "block" }}>
            {playing === p.id ? "■ หยุด · " : "▶ "}
            {p.label}
          </span>
          <span className="row-sub" style={{ display: "block" }}>
            {p.detail}
          </span>
        </button>
      ))}
      {status && (
        <p className="note" role="status">
          {status}
        </p>
      )}
      {info && <p className="note">{info}</p>}
    </div>
  );
}
