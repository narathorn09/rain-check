import * as webpush from "web-push";
import { deleteDevice } from "./store";
import type { DeviceRecord } from "./types";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export interface Notice {
  title: string;
  body: string;
  tag: string;
}

/** Returns true when the push service accepted the message. */
export async function sendNotice(device: DeviceRecord, notice: Notice): Promise<boolean> {
  if (!configure()) throw new Error("VAPID keys are not configured");
  try {
    await webpush.sendNotification(device.subscription, JSON.stringify({ ...notice, url: "/" }), {
      TTL: 60 * 30,
      urgency: "high",
    });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 mean the user removed the app or revoked permission, so the record is dead.
    if (status === 404 || status === 410) {
      await deleteDevice(device.id);
      return false;
    }
    console.error("push failed", status ?? err);
    return false;
  }
}
