import { Redis } from "@upstash/redis";
import type { DeviceRecord } from "./types";

// Without Redis credentials (local dev) devices live in memory, so a restart forgets them.
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const g = globalThis as unknown as { __devices?: Map<string, DeviceRecord> };
const memory = (g.__devices ??= new Map<string, DeviceRecord>());

const INDEX = "devices";
const key = (id: string) => `device:${id}`;

export const DEVICE_ID = /^[A-Za-z0-9-]{20,64}$/;

export async function saveDevice(d: DeviceRecord): Promise<void> {
  if (!redis) {
    memory.set(d.id, d);
    return;
  }
  await Promise.all([redis.set(key(d.id), d), redis.sadd(INDEX, d.id)]);
}

export async function getDevice(id: string): Promise<DeviceRecord | null> {
  if (!redis) return memory.get(id) ?? null;
  return (await redis.get<DeviceRecord>(key(id))) ?? null;
}

export async function deleteDevice(id: string): Promise<void> {
  if (!redis) {
    memory.delete(id);
    return;
  }
  await Promise.all([redis.del(key(id)), redis.srem(INDEX, id)]);
}

export async function listDevices(): Promise<DeviceRecord[]> {
  if (!redis) return [...memory.values()];
  const ids = (await redis.smembers(INDEX)) as string[];
  if (ids.length === 0) return [];
  const rows = await redis.mget<(DeviceRecord | null)[]>(...ids.map(key));
  return rows.filter((r): r is DeviceRecord => r !== null);
}
