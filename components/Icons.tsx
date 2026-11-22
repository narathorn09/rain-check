import type { Sky } from "@/lib/sky";

// Outline icons in the style of chat-app tab bars. All use currentColor.
const base = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const UmbrellaIcon = () => (
  <svg {...base}>
    <path d="M3 12a9 9 0 0 1 18 0z" />
    <path d="M12 12v7a2 2 0 0 1-4 0" />
    <path d="M12 3v1" />
  </svg>
);

export const MapIcon = () => (
  <svg {...base}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M12 4c5 0 9 3.1 9 7s-4 7-9 7c-.9 0-1.8-.1-2.6-.3L5 20l1.2-3.6C4.2 15.1 3 13.2 3 11c0-3.9 4-7 9-7z" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const BackIcon = () => (
  <svg {...base}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base} width={22} height={22}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const PinIcon = () => (
  <svg {...base}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const BellIcon = () => (
  <svg {...base}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const MicIcon = () => (
  <svg {...base} width={24} height={24}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const PhoneIcon = () => (
  <svg {...base} width={24} height={24}>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);

export const SpeakerIcon = () => (
  <svg {...base} width={20} height={20}>
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fillOpacity="0.15" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const PlayIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

const CLOUD = "M7 15a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 15z";

/** Small static weather glyph used in list rows, one per sky type. */
export function SkyIcon({ sky }: { sky: Sky }) {
  switch (sky) {
    case "sunny":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "clear":
      return (
        <svg {...base}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case "partly":
      return (
        <svg {...base}>
          <path d="M8 3v1.5M3.5 8H2M4.8 4.8l1 1" />
          <circle cx="8.5" cy="8.5" r="3" />
          <path d="M9 20a3.5 3.5 0 0 1-.5-7 5 5 0 0 1 9.6 1.3A3 3 0 0 1 18 20z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" transform="translate(0 3)" />
        </svg>
      );
    case "fog":
      return (
        <svg {...base}>
          <path d="M4 9h16M2 13h14M6 17h16" />
        </svg>
      );
    case "drizzle":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" />
          <path d="M9 19h.01M12 21h.01M15 19h.01" strokeWidth="3" />
        </svg>
      );
    case "rain":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" />
          <path d="M10 18v2M14 18v2" />
        </svg>
      );
    case "moderate":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" />
          <path d="M9 18l-.5 2.5M12 18l-.5 2.5M15 18l-.5 2.5" />
        </svg>
      );
    case "heavy":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" />
          <path d="M8 18l-1 3M11 18l-1 3M14 18l-1 3M17 18l-1 3" />
        </svg>
      );
    case "storm":
      return (
        <svg {...base}>
          <path d={CLOUD} fill="currentColor" fillOpacity="0.15" />
          <path d="M12 16l-2 3h3l-2 3" />
        </svg>
      );
  }
}
