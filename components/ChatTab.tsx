"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";
import { Avatar } from "./Avatar";
import { MicIcon } from "./Icons";

interface Msg {
  role: "user" | "model";
  text: string;
  at: number;
  failed?: boolean;
}

const QUICK = [
  "วันนี้ควรพกร่มไหม",
  "วันนี้ฝนจะตกตอนไหน",
  "ออกจากบ้านกี่โมงดี",
  "พรุ่งนี้ฝนจะตกไหม",
];

const GREETING =
  "สวัสดีค่ะ น้องฝนเองค่ะ ถามเรื่องฝนได้เลยนะคะ กดปุ่มด้านล่างหรือพูดก็ได้ค่ะ";

function hhmm(at: number): string {
  return new Date(at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
}

// Web Speech types are not in lib.dom for all targets.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function makeRecognition(): Recognition | null {
  const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor() as Recognition;
  r.lang = "th-TH";
  r.interimResults = false;
  return r;
}

export function ChatTab({ place }: { place: Place }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMic(Boolean((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition));
    setCanSpeak("speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q, at: Date.now() }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })), place }),
      });
      const data = (await res.json()) as { text?: string };
      if (!res.ok || !data.text) throw new Error();
      setMsgs([...next, { role: "model", text: data.text, at: Date.now() }]);
      speak(data.text, next.length);
    } catch {
      setMsgs([
        ...next,
        { role: "model", text: "ขอโทษค่ะ น้องฝนตอบไม่ได้ในตอนนี้ ลองถามใหม่อีกครั้งนะคะ", at: Date.now(), failed: true },
      ]);
    }
    setBusy(false);
  }

  function speak(t: string, index: number) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    if (speaking === index) {
      setSpeaking(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "th-TH";
    u.rate = 0.9;
    u.onend = () => setSpeaking(null);
    u.onerror = () => setSpeaking(null);
    setSpeaking(index);
    synth.speak(u);
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = makeRecognition();
    if (!r) return;
    recRef.current = r;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      if (said) ask(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div className="chat">
      <div className="chat-log">
        <ModelBubble text={GREETING} />
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg user">
              <div className="bubble-wrap">
                <div className="bubble">{m.text}</div>
              </div>
              <span className="time">{hhmm(m.at)}</span>
            </div>
          ) : (
            <ModelBubble key={i} text={m.text} at={m.at}>
              {!m.failed && canSpeak && (
                <button type="button" className="btn small" onClick={() => speak(m.text, i)}>
                  {speaking === i ? "หยุดอ่าน" : "ฟังคำตอบ"}
                </button>
              )}
            </ModelBubble>
          ),
        )}
        {busy && (
          <ModelBubble text="">
            <span className="typing" role="status" aria-label="น้องฝนกำลังพิมพ์">
              <span />
              <span />
              <span />
            </span>
          </ModelBubble>
        )}
        <div ref={endRef} />
      </div>

      <div className="pills">
        {QUICK.map((q) => (
          <button key={q} type="button" className="pill" onClick={() => ask(q)} disabled={busy}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        {hasMic && (
          <button type="button" className={`mic ${listening ? "live" : ""}`} onClick={toggleMic} aria-label="พูดถามน้องฝน">
            <MicIcon />
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "พูดได้เลยค่ะ…" : "พิมพ์คำถาม"}
          aria-label="พิมพ์คำถาม"
        />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
          ส่ง
        </button>
      </form>
    </div>
  );
}

function ModelBubble({ text, at, children }: { text: string; at?: number; children?: React.ReactNode }) {
  return (
    <div className="msg model">
      <Avatar />
      <div className="bubble-wrap">
        <span className="who">น้องฝน</span>
        <div className="bubble">
          {text}
          {children}
        </div>
      </div>
      {at !== undefined && <span className="time">{hhmm(at)}</span>}
    </div>
  );
}
