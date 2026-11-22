"use client";

import type { Settings } from "./settings";

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type EnableResult = "ok" | "denied" | "unsupported" | "no-key";

/** Asks permission (must follow a tap) and creates the push subscription. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return "no-key";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (!existing) {
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  }
  return "ok";
}

export async function disablePush(deviceId: string): Promise<void> {
  const sub = await currentSubscription();
  await sub?.unsubscribe();
  await fetch(`/api/push?id=${encodeURIComponent(deviceId)}`, { method: "DELETE" }).catch(() => {});
}

/** Pushes the current settings to the server. No-op until a spot is chosen and push is on. */
export async function syncDevice(s: Settings): Promise<boolean> {
  if (!s.place || !pushSupported() || Notification.permission !== "granted") return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  const res = await fetch("/api/push", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: s.deviceId,
      subscription: sub.toJSON(),
      place: s.place,
      morning: s.morning,
      morningMinutes: s.morningMinutes,
      alert: s.alert,
    }),
  });
  return res.ok;
}

export type LocalTestResult = "ok" | "no-permission" | "unsupported" | "error";

/**
 * Shows a notification straight from this phone's service worker, with no server or push
 * service involved. If this one does not appear, the phone's own settings are blocking it.
 */
export async function localTestNotification(): Promise<LocalTestResult> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission !== "granted") return "no-permission";
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("เช็คฝน (ทดสอบบนเครื่องนี้)", {
      body: "ถ้าเห็นข้อความนี้ แปลว่ามือถือแสดงแจ้งเตือนได้ปกติค่ะ",
      icon: "/icon-192",
      badge: "/icon-192",
      tag: "local-test",
    });
    return "ok";
  } catch {
    return "error";
  }
}

export async function sendTest(deviceId: string): Promise<boolean> {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: deviceId }),
  });
  return res.ok;
}
