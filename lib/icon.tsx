import { ImageResponse } from "next/og";

// Solid fills only: the OG image renderer's gradient support inside inline SVG is unreliable.
const INK = "#1d2b3a";

/** App icon: น้องฝน on a sky-blue tile. `safe` shrinks the art into the maskable safe zone. */
export function renderIcon(size: number, safe: boolean) {
  const art = safe ? size * 0.62 : size * 0.82;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b5cad",
        }}
      >
        <svg width={art} height={art} viewBox="0 0 120 120">
          <path d="M30 84 q-12 4 -16 -4" stroke="#bfe1ff" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M90 82 q14 -6 16 -22" stroke="#bfe1ff" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M60 6 C60 6 26 48 26 76 A34 34 0 0 0 94 76 C94 48 60 6 60 6 Z" fill="#6cbcff" stroke="#ffffff" strokeWidth="3" />
          <ellipse cx="45" cy="56" rx="5" ry="10" fill="#ffffff" opacity="0.6" transform="rotate(-22 45 56)" />
          <ellipse cx="40" cy="90" rx="6.5" ry="3.8" fill="#ff9db0" />
          <ellipse cx="80" cy="90" rx="6.5" ry="3.8" fill="#ff9db0" />
          <circle cx="48" cy="78" r="6.5" fill={INK} />
          <circle cx="72" cy="78" r="6.5" fill={INK} />
          <circle cx="50.5" cy="75.5" r="2.2" fill="#ffffff" />
          <circle cx="74.5" cy="75.5" r="2.2" fill="#ffffff" />
          <path d="M53 90 Q60 98 67 90" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

/**
 * Notification badge: Android draws only the alpha channel of this image, so it is a plain
 * white raindrop on transparency (a coloured icon would show as a white square).
 */
export function renderBadge(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 120 120">
          <path d="M60 6 C60 6 26 48 26 76 A34 34 0 0 0 94 76 C94 48 60 6 60 6 Z" fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
