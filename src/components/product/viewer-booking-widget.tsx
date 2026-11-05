"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";

import { useViewer } from "@/components/viewer/viewer-provider";
import { parseBookingResume } from "@/lib/validation/cart";

import { BookingWidget } from "./booking-widget";

type Props = Omit<
  ComponentProps<typeof BookingWidget>,
  "initialDate" | "resume" | "isLoggedIn" | "onCartChange"
>;

/**
 * 상세의 예약 위젯 (S2) — 상세 HTML은 캐시되므로 주소 쿼리와 로그인 여부는 브라우저에서 읽는다.
 * - ?date=: 목록의 이용일 필터에서 넘어온 날짜 / ?resume=…: 로그인하고 돌아온 경우 고른 내용 전체 (Q1)
 * - useSearchParams는 정적 페이지에서 Suspense 경계가 필요하다 → 상세 페이지가 쿼리 없는 위젯을 fallback으로 감싼다.
 *   (캐시된 HTML에는 기본 위젯이 들어가고, 쿼리가 있으면 브라우저에서 고른 내용으로 다시 그린다)
 * - 로그인 정보를 받기 전(loading)에는 로그인한 것으로 보고 진행한다: 아니면 서버가 거절하고 로그인 화면으로 보낸다.
 */
export function ViewerBookingWidget(props: Props) {
  const params = useSearchParams();
  const { status, user, refresh } = useViewer();
  const query = Object.fromEntries(params);
  const resume = parseBookingResume(query);
  const initialDate = resume?.date ?? (typeof query.date === "string" ? query.date : null);

  return (
    <BookingWidget
      {...props}
      // 쿼리가 바뀌면(로그인 복귀 등) 고른 내용을 처음부터 다시 잡는다
      key={params.toString()}
      initialDate={initialDate}
      resume={resume}
      isLoggedIn={status === "loading" || user !== null}
      onCartChange={refresh}
    />
  );
}
