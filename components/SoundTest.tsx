"use client";

import { useEffect, useRef, useState } from "react";
import { PcmTimeline, STREAM_RATE, primeAudio, stopPcm } from "@/lib/client/pcmPlayer";
import { pcmToWav } from "@/lib/wav";

// One sentence of น้องฝน's real voice, fetched once and replayed through each path.
const SAMPLE_TEXT = "สวัสดีค่ะ น้องฝนกำลังทดสอบเสียงอยู่นะคะ วันนี้อากาศดี ไม่มีฝนค่ะ";

type Path = "tone" | "native" | "app" | "plain" | "stream" | "streamMic";

const PATHS: { id: Path; letter: string; label: string; detail: string }[] = [
  { id: "tone", letter: "A", label: "เสียงหึ่งทดสอบ", detail: "เสียงสังเคราะห์ล้วน ผ่านตัวเล่นของแอป" },
  { id: "native", letter: "B", label: "เสียงน้องฝน (ตัวเล่นมาตรฐาน)", detail: "ไม่ผ่านตัวเล่นของแอปเลย" },
  { id: "app", letter: "C", label: "เสียงน้องฝน (ตัวเล่นของแอป)", detail: "เสียงที่โหลดไว้ครบแล้ว" },
  { id: "plain", letter: "D", label: "เสียงน้องฝน (Web Audio พื้นฐาน)", detail: "ไม่ผ่านตัวกรองและตัวกำจัดคลิก" },
  { id: "stream", letter: "E", label: "เสียงน้องฝน (สตรีมสด)", detail: "เล่นไปโหลดไป แบบตอนอ่านคำตอบในแชต" },
  { id: "streamMic", letter: "F", label: "สตรีมสด + เปิดไมค์", detail: "แบบตอนโทรคุย (ขออนุญาตใช้ไมค์)" },
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

/** Describes a failed /api/tts call; Gemini's own status (429 = quota used up) matters most. */
async function failure(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { upstream?: number | null } | null;
  if (body?.upstream === 429) return "โควตาเสียงของ Gemini หมด (429)";
  return `HTTP ${res.status}${body?.upstream ? ` · Gemini ${body.upstream}` : ""}`;
}

function errText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
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
  // On-screen log, because a phone has no console to read when nothing plays.
  const [log, setLog] = useState<string[]>([]);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const plainSrc = useRef<AudioBufferSourceNode | null>(null);
  const micRef = useRef<MediaStream | null>(null);

  const note = (line: string) => setLog((l) => [...l.slice(-11), line]);

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
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
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
      if (!res.ok) throw new Error(await failure(res));
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 2) throw new Error("ได้ข้อมูลเสียงว่าง");
      setVoice(bytes);
      setStatus("");
      note(`โหลดเสียงน้องฝนแล้ว ${(bytes.length / 2 / STREAM_RATE).toFixed(1)} วิ`);
      return bytes;
    } catch (e) {
      setStatus("โหลดเสียงน้องฝนไม่ได้ ลองใหม่อีกครั้งค่ะ");
      note(`โหลดเสียงไม่ได้ (${errText(e)})`);
      return null;
    }
  }

  async function play(path: Path) {
    stopAll();
    const letter = PATHS.find((p) => p.id === path)?.letter ?? "?";
    const started = performance.now();
    // Unlock audio during the tap, before any await.
    let ctx: AudioContext | null = null;
    try {
      ctx = primeAudio();
    } catch (e) {
      note(`${letter}: เปิดระบบเสียงไม่ได้ (${errText(e)})`);
    }
    if (ctx) {
      setInfo(`อัตราเสียงของเครื่อง ${ctx.sampleRate} Hz · หน่วง ${Math.round((ctx.baseLatency ?? 0) * 1000)} ms`);
      const c = ctx;
      // The state right after the tap, and again a moment later once resume() settled.
      note(`${letter}: เริ่ม · ระบบเสียง ${c.state}`);
      setTimeout(() => note(`${letter}: ระบบเสียงหลังแตะ ${c.state}`), 600);
    } else {
      note(`${letter}: เริ่ม · ไม่มีระบบเสียง Web Audio`);
    }
    setPlaying(path);
    const done = (why = "จบ") => {
      note(`${letter}: ${why} หลัง ${((performance.now() - started) / 1000).toFixed(1)} วิ`);
      setPlaying((p) => (p === path ? null : p));
    };

    const finish = (t: PcmTimeline) => t.whenDone(() => done(`จบ · สะดุด ${t.stalls} ครั้ง ·`));

    try {
      if (path === "tone") {
        const t = new PcmTimeline(STREAM_RATE, () => false);
        t.appendPcm(toneBytes());
        finish(t);
        return;
      }

      if (path === "stream" || path === "streamMic") {
        let mic: MediaStream | null = null;
        if (path === "streamMic") {
          // Same constraints as a voice call: Android may switch to its call audio mode here.
          mic = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          micRef.current = mic;
          note(`${letter}: เปิดไมค์แล้ว · ระบบเสียง ${ctx?.state ?? "-"}`);
        }
        const t = new PcmTimeline(STREAM_RATE, () => false);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: SAMPLE_TEXT }),
        });
        if (!res.ok || !res.body) throw new Error(await failure(res));
        note(`${letter}: เสียงแรกมาหลัง ${((performance.now() - started) / 1000).toFixed(1)} วิ`);
        await t.appendStream(res.body);
        t.whenDone(() => {
          mic?.getTracks().forEach((tr) => tr.stop());
          if (micRef.current === mic) micRef.current = null;
          done(`จบ · สะดุด ${t.stalls} ครั้ง ·`);
        });
        return;
      }

      const bytes = await loadVoice();
      if (!bytes) return done("ไม่มีเสียงให้เล่น");

      if (path === "native") {
        const wav = pcmToWav(bytes, STREAM_RATE);
        const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }));
        const el = new Audio(url);
        audioEl.current = el;
        el.onended = () => {
          URL.revokeObjectURL(url);
          done();
        };
        el.onerror = () => done(`เล่นไม่ได้ (โค้ด ${el.error?.code ?? "?"})`);
        el.play().catch((e) => done(`เครื่องไม่ยอมเล่น (${errText(e)})`));
        return;
      }

      if (path === "app") {
        const t = new PcmTimeline(STREAM_RATE, () => false);
        t.appendPcm(bytes);
        finish(t);
        return;
      }

      // Plain Web Audio: one buffer straight to the speaker, nothing in between.
      if (!ctx) return done("ไม่มีระบบเสียง Web Audio");
      const n = Math.floor(bytes.length / 2);
      const buf = ctx.createBuffer(1, n, STREAM_RATE);
      const ch = buf.getChannelData(0);
      const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
      for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => done();
      plainSrc.current = src;
      src.start();
    } catch (e) {
      done(`ผิดพลาด (${errText(e)})`);
    }
  }

  return (
    <div className="stack">
      <p className="note">
        เปิดเสียงมือถือ (เสียงสื่อ) ให้ดังก่อน แล้วกดฟังทีละปุ่ม จดว่าปุ่มไหนมีเสียงแตก ส่งผลให้คนดูแลแอปได้เลยค่ะ
        (ใช้เสียงลำโพงปกติ ไม่ต้องเสียบหูฟัง)
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
            {p.letter}. {p.label}
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
      {log.length > 0 && (
        <pre className="sound-log" aria-label="บันทึกการทดสอบเสียง">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
