import { NextResponse } from "next/server";
import { storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Configuration check for setup and debugging. Reports only yes/no, never values. */
export function GET() {
  return NextResponse.json({
    storage: storageMode,
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    assistant: Boolean(process.env.GEMINI_API_KEY),
    scheduler: Boolean(process.env.CRON_SECRET),
  });
}
