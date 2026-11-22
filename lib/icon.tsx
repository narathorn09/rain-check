import { ImageResponse } from "next/og";

/** Draws the app icon (a cloud with rain drops). `safe` shrinks the art for maskable icons. */
export function renderIcon(size: number, safe: boolean) {
  const art = safe ? size * 0.6 : size * 0.78;
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
        <svg width={art} height={art} viewBox="0 0 100 100">
          <path
            d="M28 62a16 16 0 0 1 2-32 22 22 0 0 1 42 6 13 13 0 0 1-2 26z"
            fill="#ffffff"
          />
          <g stroke="#bfe1ff" strokeWidth="7" strokeLinecap="round">
            <line x1="34" y1="74" x2="29" y2="88" />
            <line x1="52" y1="74" x2="47" y2="88" />
            <line x1="70" y1="74" x2="65" y2="88" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
