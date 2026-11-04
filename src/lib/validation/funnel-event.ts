import { z } from "zod";

import { DEVICES, FUNNEL_EVENTS } from "@/lib/funnel";

/** 퍼널 이벤트 수집 요청 (/api/events) — DB CHECK와 같은 값만 받는다 */
export const funnelEventSchema = z.object({
  name: z.enum(FUNNEL_EVENTS),
  sessionId: z.uuid(),
  productId: z.uuid().optional(),
  device: z.enum(DEVICES),
});
