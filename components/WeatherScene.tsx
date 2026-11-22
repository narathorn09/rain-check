import type { CSSProperties } from "react";
import type { Level } from "@/lib/types";

const LABEL: Record<Level, string> = { dry: "อากาศดี", light: "ฝนเบา", heavy: "ฝนตกหนัก" };

// Fixed drop positions keep the scene identical on every render (no random flicker).
const LIGHT_DROPS = [60, 92, 124, 156, 188, 220, 252].map((x, i) => ({ x, delay: (i * 0.37) % 1.4 }));
const HEAVY_DROPS = Array.from({ length: 26 }, (_, i) => ({
  x: 20 + ((i * 47) % 290),
  delay: (i * 0.13) % 0.7,
}));

function Cloud({ x, y, scale, fill }: { x: number; y: number; scale: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={fill}>
      <circle cx="0" cy="10" r="22" />
      <circle cx="26" cy="0" r="28" />
      <circle cx="56" cy="10" r="22" />
      <rect x="0" y="10" width="56" height="22" />
    </g>
  );
}

/** Animated picture of the weather: sun, light rain, or heavy rain with lightning. */
export function WeatherScene({ level, className }: { level: Level; className?: string }) {
  return (
    <svg
      className={`ws ws-${level} ${className ?? ""}`}
      viewBox="0 0 320 180"
      role="img"
      aria-label={`ภาพ${LABEL[level]}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`sky-${level}`} x1="0" y1="0" x2="0" y2="1">
          {level === "dry" && (
            <>
              <stop offset="0" stopColor="#7cc8ff" />
              <stop offset="1" stopColor="#e6f6ff" />
            </>
          )}
          {level === "light" && (
            <>
              <stop offset="0" stopColor="#8fa3ba" />
              <stop offset="1" stopColor="#dbe4ee" />
            </>
          )}
          {level === "heavy" && (
            <>
              <stop offset="0" stopColor="#2c3747" />
              <stop offset="1" stopColor="#5d6b7d" />
            </>
          )}
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#sky-${level})`} />

      {level === "dry" && (
        <>
          <g className="ws-sun">
            <g className="ws-rays" stroke="#ffb800" strokeWidth="6" strokeLinecap="round">
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i} x1="240" y1="18" x2="240" y2="30" transform={`rotate(${i * 45} 240 62)`} />
              ))}
            </g>
            <circle cx="240" cy="62" r="24" fill="#ffd23f" />
          </g>
          <g className="ws-drift">
            <Cloud x={40} y={50} scale={0.9} fill="#ffffff" />
          </g>
          {/* Fade the whole cloud; a translucent fill would show where its circles overlap. */}
          <g className="ws-drift ws-drift-slow" opacity="0.8">
            <Cloud x={130} y={100} scale={0.6} fill="#ffffff" />
          </g>
          <rect y="150" width="320" height="30" fill="#7ccf6b" />
          <rect y="150" width="320" height="6" fill="#64b955" />
        </>
      )}

      {level === "light" && (
        <>
          <g className="ws-drift ws-drift-slow">
            <Cloud x={110} y={36} scale={1.1} fill="#eef2f6" />
          </g>
          <g stroke="#3f7fd1" strokeWidth="4" strokeLinecap="round">
            {LIGHT_DROPS.map((d) => (
              <line
                key={d.x}
                className="ws-drop"
                x1={d.x}
                y1="80"
                x2={d.x}
                y2="92"
                style={{ "--dur": "1.4s", "--delay": `${d.delay}s`, "--dx": "0px" } as CSSProperties}
              />
            ))}
          </g>
          <rect y="150" width="320" height="30" fill="#8ea7a0" />
          <ellipse className="ws-ripple" cx="110" cy="163" rx="18" ry="4" fill="none" stroke="#dbe4ee" strokeWidth="2" />
        </>
      )}

      {level === "heavy" && (
        <>
          <rect className="ws-flash-sky" width="320" height="180" fill="#ffffff" />
          <Cloud x={20} y={30} scale={1.2} fill="#3a4555" />
          <Cloud x={170} y={22} scale={1.35} fill="#323c4b" />
          <polygon
            className="ws-bolt"
            points="190,70 172,112 188,112 176,150 214,98 196,98 208,70"
            fill="#ffe14d"
          />
          <g stroke="#9cc7ff" strokeWidth="3.5" strokeLinecap="round">
            {HEAVY_DROPS.map((d) => (
              <line
                key={d.x}
                className="ws-drop"
                x1={d.x}
                y1="70"
                x2={d.x - 6}
                y2="88"
                style={{ "--dur": "0.6s", "--delay": `${d.delay}s`, "--dx": "-22px" } as CSSProperties}
              />
            ))}
          </g>
          <rect y="150" width="320" height="30" fill="#4f6170" />
          <ellipse className="ws-ripple" cx="70" cy="164" rx="20" ry="4" fill="none" stroke="#9cc7ff" strokeWidth="2" />
          <ellipse className="ws-ripple ws-ripple-late" cx="230" cy="166" rx="24" ry="5" fill="none" stroke="#9cc7ff" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

export const SCENE_LABEL = LABEL;
