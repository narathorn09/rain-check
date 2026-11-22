import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      {
        // A stale service worker would keep serving old push handling code.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default config;
