/** Who น้องฝน is talking to, so the app can be handed to someone else. */
export interface Profile {
  /** How น้องฝน addresses the user, e.g. "คุณแม่" or "พี่สมศรี". Empty means no name. */
  callName: string;
  /** What the user usually does, used to tailor advice. Empty means not given. */
  routine: string;
}

export const CALL_NAMES = ["คุณแม่", "คุณพ่อ", "คุณยาย", "คุณตา", "คุณป้า", "คุณลุง"];
export const ROUTINES = ["ขายของกลางแจ้ง", "ทำสวน ทำนา", "ออกไปทำงานนอกบ้าน", "อยู่บ้านเป็นส่วนใหญ่"];

const MAX_NAME = 30;
const MAX_ROUTINE = 60;

// These values go into the model prompt, so keep them to one short plain line.
function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanProfile(raw: { callName?: unknown; routine?: unknown } | null | undefined): Profile {
  return { callName: clean(raw?.callName, MAX_NAME), routine: clean(raw?.routine, MAX_ROUTINE) };
}
