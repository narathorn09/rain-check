import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "เช็คฝน",
  description: "ดูว่าฝนจะตกตอนไหน ดูง่าย เข้าใจง่าย",
  applicationName: "เช็คฝน",
  appleWebApp: { capable: true, title: "เช็คฝน", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b5cad",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  // Shrink the layout when the keyboard opens so the chat input stays above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={font.className}>
      <body>{children}</body>
    </html>
  );
}
