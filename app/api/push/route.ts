import { NextRequest, NextResponse } from "next/server";
import { sendNotice } from "@/lib/push";
import { testMessage } from "@/lib/messages";
import { DEVICE_ID, deleteDevice, getDevice, saveDevice } from "@/lib/store";
import { validCoords } from "@/lib/weather";
import type { DeviceRecord } from "@/lib/types";

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

function parse(body: unknown): DeviceRecord | null {
  const b = body as Record<string, any> | null;
  if (!b || typeof b.id !== "string" || !DEVICE_ID.test(b.id)) return null;
  const sub = b.subscription;
  if (
    typeof sub?.endpoint !== "string" ||
    !sub.endpoint.startsWith("https://") ||
    typeof sub?.keys?.p256dh !== "string" ||
    typeof sub?.keys?.auth !== "string"
  ) {
    return null;
  }
  const lat = num(b.place?.lat, -90, 90);
  const lon = num(b.place?.lon, -180, 180);
  const start = num(b.window?.start, 0, 23);
  const end = num(b.window?.end, 1, 24);
  const morningMinutes = num(b.morningMinutes, 0, 1439);
  if (lat === null || lon === null || !validCoords(lat, lon)) return null;
  if (start === null || end === null || end <= start || morningMinutes === null) return null;

  return {
    id: b.id,
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    place: { name: String(b.place?.name ?? "จุดขายของ").slice(0, 60), lat, lon },
    window: { start, end },
    morning: b.morning === true,
    morningMinutes,
    alert: b.alert === true,
  };
}

/** Create or update this device's subscription and notification settings. */
export async function PUT(req: NextRequest) {
  const device = parse(await req.json().catch(() => null));
  if (!device) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const prev = await getDevice(device.id);
  // Keep send history so editing settings does not trigger a duplicate alert.
  await saveDevice({ ...device, lastMorning: prev?.lastMorning, lastAlert: prev?.lastAlert });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DEVICE_ID.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  await deleteDevice(id);
  return NextResponse.json({ ok: true });
}

/** Send a test notification to this device. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !DEVICE_ID.test(body.id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const device = await getDevice(body.id);
  if (!device) return NextResponse.json({ error: "not subscribed" }, { status: 404 });
  const ok = await sendNotice(device, testMessage());
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
