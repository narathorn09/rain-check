import type { CSSProperties } from "react";
import { SKY_LABEL, type Sky } from "@/lib/sky";

interface CloudSpec {
  x: number;
  y: number;
  scale: number;
  fill: string;
  slow?: boolean;
  faded?: boolean;
}

interface DropSpec {
  count: number;
  /** Seconds for one fall. */
  dur: number;
  /** Sideways travel while falling; negative slants left. */
  dx: number;
  color: string;
  width: number;
  length: number;
}

interface Scene {
  sky: [string, string];
  ground: string;
  sun?: boolean;
  moon?: boolean;
  clouds: CloudSpec[];
  drops?: DropSpec;
  ripples?: boolean;
  bolt?: boolean;
  fog?: boolean;
}

const GREEN = "#7ccf6b";

const SCENES: Record<Sky, Scene> = {
  sunny: {
    sky: ["#7cc8ff", "#e6f6ff"],
    ground: GREEN,
    sun: true,
    clouds: [
      { x: 40, y: 50, scale: 0.9, fill: "#ffffff" },
      { x: 130, y: 100, scale: 0.6, fill: "#ffffff", slow: true, faded: true },
    ],
  },
  clear: {
    sky: ["#0f1d3a", "#2e4677"],
    ground: "#2f4a3a",
    moon: true,
    clouds: [],
  },
  partly: {
    sky: ["#86c3ef", "#e3f1fb"],
    ground: GREEN,
    sun: true,
    clouds: [
      { x: 170, y: 64, scale: 1.15, fill: "#ffffff" },
      { x: 30, y: 84, scale: 0.8, fill: "#f2f6fa", slow: true },
    ],
  },
  cloudy: {
    sky: ["#93a2b2", "#dbe2e9"],
    ground: "#8fb08a",
    clouds: [
      { x: 10, y: 46, scale: 1.1, fill: "#e9edf1" },
      { x: 150, y: 34, scale: 1.35, fill: "#d8dee5", slow: true },
      { x: 90, y: 88, scale: 0.95, fill: "#f4f6f8" },
    ],
  },
  fog: {
    sky: ["#c3ccd4", "#eef1f3"],
    ground: "#a9b6ad",
    fog: true,
    clouds: [{ x: 110, y: 30, scale: 1.1, fill: "#e8ecef", slow: true }],
  },
  drizzle: {
    sky: ["#a5b4c3", "#e1e8ee"],
    ground: "#8ea7a0",
    clouds: [{ x: 110, y: 36, scale: 1.1, fill: "#eef2f6", slow: true }],
    drops: { count: 14, dur: 1.9, dx: 0, color: "#5b8fd6", width: 2, length: 6 },
  },
  rain: {
    sky: ["#8fa3ba", "#dbe4ee"],
    ground: "#8ea7a0",
    clouds: [{ x: 110, y: 36, scale: 1.1, fill: "#eef2f6", slow: true }],
    drops: { count: 8, dur: 1.4, dx: 0, color: "#3f7fd1", width: 4, length: 12 },
    ripples: true,
  },
  moderate: {
    sky: ["#6f8197", "#c3cfdb"],
    ground: "#7f978f",
    clouds: [
      { x: 30, y: 34, scale: 1.1, fill: "#c9d2dc" },
      { x: 170, y: 28, scale: 1.2, fill: "#b9c4d0", slow: true },
    ],
    drops: { count: 16, dur: 0.95, dx: -8, color: "#2f6fc4", width: 3.5, length: 14 },
    ripples: true,
  },
  heavy: {
    sky: ["#36445a", "#66768a"],
    ground: "#4f6170",
    clouds: [
      { x: 20, y: 30, scale: 1.2, fill: "#46536a" },
      { x: 170, y: 22, scale: 1.35, fill: "#3d4a5e", slow: true },
    ],
    drops: { count: 26, dur: 0.6, dx: -22, color: "#9cc7ff", width: 3.5, length: 18 },
    ripples: true,
  },
  storm: {
    sky: ["#2c3747", "#5d6b7d"],
    ground: "#4f6170",
    clouds: [
      { x: 20, y: 30, scale: 1.2, fill: "#3a4555" },
      { x: 170, y: 22, scale: 1.35, fill: "#323c4b", slow: true },
    ],
    drops: { count: 26, dur: 0.6, dx: -22, color: "#9cc7ff", width: 3.5, length: 18 },
    ripples: true,
    bolt: true,
  },
};

// Fixed positions keep the picture identical on every render (no random flicker).
function dropsFor(d: DropSpec) {
  return Array.from({ length: d.count }, (_, i) => ({
    x: 20 + ((i * 47) % 290),
    delay: ((i * 0.37) % d.dur).toFixed(2),
  }));
}

const STARS = [
  [30, 30],
  [70, 70],
  [110, 24],
  [150, 56],
  [200, 18],
  [260, 90],
  [290, 40],
  [90, 110],
];

function Cloud({ x, y, scale, fill }: CloudSpec) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={fill}>
      <circle cx="0" cy="10" r="22" />
      <circle cx="26" cy="0" r="28" />
      <circle cx="56" cy="10" r="22" />
      <rect x="0" y="10" width="56" height="22" />
    </g>
  );
}

/** Animated picture of the sky for each weather condition. */
export function WeatherScene({ sky, className }: { sky: Sky; className?: string }) {
  const s = SCENES[sky];
  const gradient = `sky-${sky}`;
  return (
    <svg
      className={`ws ${className ?? ""}`}
      viewBox="0 0 320 180"
      role="img"
      aria-label={`ภาพ${SKY_LABEL[sky]}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gradient})`} />
      {s.bolt && <rect className="ws-flash-sky" width="320" height="180" fill="#ffffff" />}

      {s.moon && (
        <>
          {STARS.map(([x, y], i) => (
            <circle
              key={i}
              className="ws-star"
              cx={x}
              cy={y}
              r="1.8"
              fill="#fffbe0"
              style={{ animationDelay: `${(i * 0.4) % 2}s` }}
            />
          ))}
          <circle cx="240" cy="60" r="24" fill="#f6f1c7" />
          {/* A sky-coloured disc offset over the moon leaves a crescent. */}
          <circle cx="252" cy="52" r="21" fill={s.sky[0]} />
        </>
      )}

      {s.sun && (
        <g className="ws-sun">
          <g className="ws-rays" stroke="#ffb800" strokeWidth="6" strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="240" y1="18" x2="240" y2="30" transform={`rotate(${i * 45} 240 62)`} />
            ))}
          </g>
          <circle cx="240" cy="62" r="24" fill="#ffd23f" />
        </g>
      )}

      {s.clouds.map((c, i) => (
        // Fading the whole group avoids visible overlaps that a translucent fill would show.
        <g key={i} className={`ws-drift ${c.slow ? "ws-drift-slow" : ""}`} opacity={c.faded ? 0.8 : 1}>
          <Cloud {...c} />
        </g>
      ))}

      {s.bolt && (
        <polygon className="ws-bolt" points="190,70 172,112 188,112 176,150 214,98 196,98 208,70" fill="#ffe14d" />
      )}

      {s.drops && (
        <g stroke={s.drops.color} strokeWidth={s.drops.width} strokeLinecap="round">
          {dropsFor(s.drops).map((d) => (
            <line
              key={d.x}
              className="ws-drop"
              x1={d.x}
              y1="72"
              x2={d.x + s.drops!.dx / 4}
              y2={72 + s.drops!.length}
              style={{ "--dur": `${s.drops!.dur}s`, "--delay": `${d.delay}s`, "--dx": `${s.drops!.dx}px` } as CSSProperties}
            />
          ))}
        </g>
      )}

      <rect y="150" width="320" height="30" fill={s.ground} />

      {s.fog && (
        <g fill="#ffffff">
          <rect className="ws-fog" x="-40" y="96" width="260" height="14" rx="7" opacity="0.75" />
          <rect className="ws-fog ws-fog-late" x="90" y="120" width="280" height="16" rx="8" opacity="0.7" />
          <rect className="ws-fog" x="-20" y="146" width="300" height="16" rx="8" opacity="0.8" />
        </g>
      )}

      {s.ripples && (
        <g fill="none" stroke={s.drops?.color ?? "#9cc7ff"} strokeWidth="2">
          <ellipse className="ws-ripple" cx="70" cy="164" rx="20" ry="4" />
          <ellipse className="ws-ripple ws-ripple-late" cx="230" cy="166" rx="24" ry="5" />
        </g>
      )}
    </svg>
  );
}
