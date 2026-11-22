import { renderBadge } from "@/lib/icon";

export const dynamic = "force-static";

export function GET() {
  return renderBadge(96);
}
