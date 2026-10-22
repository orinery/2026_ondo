import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getAdminOrders } from "@/lib/data/admin";
import { formatTimestamp } from "@/lib/format";
import { statusLabel } from "@/lib/order-status";
import { seoulNow } from "@/lib/trip-dates";
import { parseAdminOrderParams } from "@/lib/validation/admin-filters";

/**
 * 관리자: 주문 목록 CSV 내려받기 (/admin/orders/export?…목록과 같은 필터)
 * - 최대 5,000건 (DB 함수 admin_orders의 상한)
 * - 예약자 연락처(전화·이메일)는 넣지 않는다 — 파일은 밖으로 돌기 쉬워 최소한만 (개인정보 최소화)
 * - 엑셀이 한글을 깨뜨리지 않게 UTF-8 BOM을 붙인다
 * 관리자가 아니면 404 (관리자 화면과 같은 규칙). DB 함수가 is_admin()으로 다시 거른다.
 */
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Not Found", { status: 404 });

  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const { filters } = parseAdminOrderParams(raw);
  const { rows } = await getAdminOrders(filters, { limit: MAX_ROWS, offset: 0 });

  const header = [
    "주문번호",
    "결제일시",
    "예약자",
    "상품",
    "항목 수",
    "파트너",
    "결제액",
    "환불액",
    "상태",
    "부분 취소",
  ];
  const lines = rows.map((o) =>
    [
      o.orderNo,
      formatTimestamp(o.paidAt, true),
      o.bookerName,
      o.firstTitle,
      o.counts.items,
      o.partnerNames,
      o.totalAmount,
      o.refundAmount ?? 0,
      statusLabel(o.displayStatus),
      o.partial ? "예" : "",
    ]
      .map(csvCell)
      .join(","),
  );
  const body = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const stamp = seoulNow().today.replaceAll("-", "");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 수식으로 해석될 수 있는 첫 글자(=,+,-,@)는 막는다 */
function csvCell(value: string | number) {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
