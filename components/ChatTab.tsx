"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import type { Place } from "@/lib/types";
import { Avatar } from "./Avatar";
import { MicIcon, SpeakerIcon } from "./Icons";
import { speak as speakAloud, stopSpeaking } from "@/lib/client/speech";

interface Msg {
  role: "user" | "model";
  text: string;
  at: number;
  failed?: boolean;
}

const QUICK = [
  "วันนี้ฝนจะตกตอนไหน",
  "ออกจากบ้านกี่โมงดี",
  "พรุ่งนี้ฝนจะตกไหม",
];

// The "สวัสดีค่ะ<name>" opening is added per user in ChatTab.
const GREETING = "น้องฝนเองค่ะ ถามเรื่องฝนได้เลยนะคะ กดปุ่มด้านล่างหรือพูดก็ได้ค่ะ";

function hhmm(at: number): string {
  return new Date(at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
}

// Web Speech types are not in lib.dom for all targets.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void)
    | null;
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
  // Partial results let the words appear in the input while the user is still speaking.
  r.interimResults = true;
  return r;
}

export function ChatTab({ place, profile }: { place: Place; profile: Profile }) {
  const greeting = profile.callName ? `สวัสดีค่ะ${profile.callName} ${GREETING}` : `สวัสดีค่ะ ${GREETING}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [noThaiVoice, setNoThaiVoice] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tapping a button would blur the input first; the keyboard then closes and the layout
  // jumps before the tap lands, so the button needed a second tap. Keep focus instead.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  // Mirrors `speaking` so async speech callbacks see the latest value, not a stale closure.
  const speakingRef = useRef<number | null>(null);

  useEffect(() => {
    setHasMic(Boolean((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition));
    return () => stopSpeaking();
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
    // Close the keyboard once the question is sent so the answer has the whole screen.
    inputRef.current?.blur();
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, text })), place, profile }),
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

  async function speak(t: string, index: number) {
    if (speakingRef.current === index) {
      stopSpeaking();
      speakingRef.current = null;
      setSpeaking(null);
      return;
    }
    speakingRef.current = index;
    setSpeaking(index);
    const result = await speakAloud(t, () => {
      // Only the reading that is still current may clear the button state.
      if (speakingRef.current === index) {
        speakingRef.current = null;
        setSpeaking(null);
      }
    });
    if (result === "no-thai-voice") setNoThaiVoice(true);
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = makeRecognition();
    if (!r) return;
    recRef.current = r;
    let latest = "";
    let sent = false;
    const send = () => {
      if (sent || !latest.trim()) return;
      sent = true;
      ask(latest);
    };
    r.onresult = (e) => {
      // Show the words as they are recognised, then send once the phrase is final.
      latest = Array.from(e.results, (res) => res[0]?.transcript ?? "").join("");
      setText(latest);
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) send();
    };
    r.onend = () => {
      setListening(false);
      // Some browsers stop without marking the last result final; send what was heard.
      send();
    };
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        <span className="day-chip">วันนี้</span>
        <ModelBubble text={greeting} />
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
              {!m.failed && (
                <button type="button" className={`listen ${speaking === i ? "on" : ""}`} onClick={() => speak(m.text, i)}>
                  <SpeakerIcon />
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

      {/* Pinned under the scrolling messages, like a chat app's input bar. */}
      <div className="chat-bottom">
        {noThaiVoice && (
          <p className="voice-note" role="status">
            เครื่องนี้ยังไม่มีเสียงอ่านภาษาไทย เสียงอาจฟังไม่ชัด ติดตั้งได้ที่ ตั้งค่าเครื่อง &gt; ภาษา &gt; การอ่านออกเสียง
            (Text-to-speech) แล้วดาวน์โหลดภาษาไทยค่ะ
          </p>
        )}

        <div className="pills" aria-label="คำถามที่ถามบ่อย">
          {QUICK.map((q) => (
            <button key={q} type="button" className="pill" onMouseDown={keepFocus} onClick={() => ask(q)} disabled={busy}>
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
            <button
              type="button"
              className={`mic ${listening ? "live" : ""}`}
              onMouseDown={keepFocus}
              onClick={toggleMic}
              aria-label="พูดถามน้องฝน"
            >
              <MicIcon />
            </button>
          )}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={listening ? "พูดได้เลยค่ะ…" : "พิมพ์คำถาม"}
            aria-label="พิมพ์คำถาม"
            enterKeyHint="send"
          />
          <button type="submit" className="send" onMouseDown={keepFocus} disabled={busy || !text.trim()}>
            ส่ง
          </button>
        </form>
      </div>
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
