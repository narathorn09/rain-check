"use client";

import { useId } from "react";
import type { Sky } from "@/lib/sky";

export type Face = "happy" | "sleep" | "think" | "worried";
export type Prop = "none" | "umbrella" | "wave";

const INK = "#1d2b3a";

/**
 * น้องฝน: a raindrop with a face. `face` sets the expression, `prop` adds an umbrella
 * or a waving arm. Bobs gently unless the phone asks for reduced motion.
 */
export function Mascot({
  face = "happy",
  prop = "none",
  size = 96,
  still = false,
  label = "น้องฝน",
}: {
  face?: Face;
  prop?: Prop;
  size?: number;
  still?: boolean;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`mascot ${still ? "" : "mascot-bob"}`}
      width={size}
      height={size * (136 / 130)}
      viewBox="0 -6 130 136"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`drop-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#3a8ee6" />
        </linearGradient>
      </defs>

      {prop === "umbrella" && (
        <g>
          <path d="M92 30 V88" stroke="#7a5a2b" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M60 34 Q92 -10 124 34 Q116 27 108 34 Q100 27 92 34 Q84 27 76 34 Q68 27 60 34 Z"
            fill="#ffc93c"
            stroke="#e0a100"
            strokeWidth="2"
          />
        </g>
      )}

      {/* Arms sit behind the body so they read as coming out from its sides. */}
      <path d="M30 88 q-12 4 -16 -4" stroke="#3a8ee6" strokeWidth="6" strokeLinecap="round" fill="none" />
      {prop === "wave" ? (
        <path className="mascot-wave" d="M90 86 q14 -6 16 -22" stroke="#3a8ee6" strokeWidth="6" strokeLinecap="round" fill="none" />
      ) : prop === "umbrella" ? (
        <path d="M88 88 q3 -1 4 -2" stroke="#3a8ee6" strokeWidth="8" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M90 88 q12 4 16 -4" stroke="#3a8ee6" strokeWidth="6" strokeLinecap="round" fill="none" />
      )}

      <path d="M60 10 C60 10 26 52 26 80 A34 34 0 0 0 94 80 C94 52 60 10 60 10 Z" fill={`url(#drop-${id})`} stroke="#2f7fd6" strokeWidth="2" />
      <ellipse cx="45" cy="60" rx="5" ry="10" fill="#ffffff" opacity="0.6" transform="rotate(-22 45 60)" />

      {/* Cheeks */}
      <ellipse cx="40" cy="94" rx="6.5" ry="3.8" fill="#ff9db0" opacity="0.85" />
      <ellipse cx="80" cy="94" rx="6.5" ry="3.8" fill="#ff9db0" opacity="0.85" />

      {face === "sleep" ? (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M43 82 q5 4 10 0" />
          <path d="M67 82 q5 4 10 0" />
          <circle cx="60" cy="97" r="2.6" fill={INK} stroke="none" />
          <text x="92" y="30" fontSize="16" fontWeight="700" fill="#5d7088" stroke="none" className="mascot-z">
            z
          </text>
          <text x="104" y="16" fontSize="12" fontWeight="700" fill="#5d7088" stroke="none" className="mascot-z mascot-z-late">
            z
          </text>
        </g>
      ) : (
        <g>
          {face === "worried" && (
            <g stroke={INK} strokeWidth="3" strokeLinecap="round">
              <path d="M41 70 l11 4" />
              <path d="M79 70 l-11 4" />
            </g>
          )}
          {/* Pupils look up when thinking. */}
          <circle cx="48" cy={face === "think" ? 79 : 82} r="6.5" fill={INK} />
          <circle cx="72" cy={face === "think" ? 79 : 82} r="6.5" fill={INK} />
          <circle cx="50.5" cy={face === "think" ? 76.5 : 79.5} r="2.2" fill="#ffffff" />
          <circle cx="74.5" cy={face === "think" ? 76.5 : 79.5} r="2.2" fill="#ffffff" />
          {face === "happy" && <path d="M53 94 Q60 102 67 94" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />}
          {face === "think" && <path d="M55 97 H65" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
          {face === "worried" && <path d="M54 99 Q60 93 66 99" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />}
        </g>
      )}
    </svg>
  );
}

/** How น้องฝน looks and what it says for each kind of weather. */
export function mascotFor(sky: Sky): { face: Face; prop: Prop; line: string } {
  switch (sky) {
    case "sunny":
      return { face: "happy", prop: "none", line: "อากาศดีค่ะ ออกไปข้างนอกได้สบายเลย" };
    case "clear":
      return { face: "sleep", prop: "none", line: "ฟ้าโปร่ง คืนนี้นอนหลับฝันดีนะคะ" };
    case "partly":
      return { face: "happy", prop: "none", line: "มีเมฆบ้าง แต่ยังไม่มีฝนค่ะ" };
    case "cloudy":
      return { face: "think", prop: "none", line: "เมฆเยอะหน่อย ดูท้องฟ้าไว้ด้วยนะคะ" };
    case "fog":
      return { face: "think", prop: "none", line: "มีหมอก เดินทางระวังด้วยนะคะ" };
    case "drizzle":
    case "rain":
      return { face: "happy", prop: "umbrella", line: "ฝนปรอยๆ พกร่มไปด้วยนะคะ" };
    case "moderate":
      return { face: "worried", prop: "umbrella", line: "ฝนตกพอสมควร กางร่มด้วยนะคะ" };
    case "heavy":
      return { face: "worried", prop: "umbrella", line: "ฝนตกหนัก หาที่หลบก่อนนะคะ" };
    case "storm":
      return { face: "worried", prop: "umbrella", line: "มีพายุ อยู่ในที่ร่มให้ปลอดภัยนะคะ" };
  }
}
