"use client";

import { useState, useTransition } from "react";

import { cancelOrder, cancelOrderItem } from "@/actions/orders";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatKrw } from "@/lib/format";

export type RefundPreview = {
  title: string;
  daysBefore: number;
  refundRate: number;
  refundAmount: number;
  pending?: boolean; // 확정 대기 → 규정과 상관없이 100%
};

/** 무엇을 취소하나: 주문 전체(취소할 수 있는 항목 모두) 또는 항목 하나 */
export type CancelTarget = { kind: "order"; orderId: string } | { kind: "item"; itemId: string };

/**
 * 예약 취소 확인 창.
 * 환불 예정액은 서버가 DB 함수 refund_quote로 계산해 넘긴 값이다 — 실제 취소(cancel_order·cancel_order_item)도
 * 같은 함수를 써서 여기서 본 금액과 실제 환불액이 같다. (자정을 넘기면 남은 일수가 바뀔 수 있어 확인 직후 취소를 권한다)
 */
export function CancelOrderDialog({
  target,
  orderNo,
  lines,
}: {
  target: CancelTarget;
  orderNo: string;
  lines: RefundPreview[];
}) {
  const single = target.kind === "item";
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totalRefund = lines.reduce((sum, l) => sum + l.refundAmount, 0);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result =
        target.kind === "order"
          ? await cancelOrder(target.orderId)
          : await cancelOrderItem(target.itemId);
      if (!result.ok) {
        return setError(
          result.reason === "unauthenticated"
            ? "로그인이 필요해요. 다시 로그인한 뒤 취소해 주세요."
            : (result.message ?? "취소하지 못했어요. 다시 시도해 주세요."),
        );
      }
      // 서버 액션이 페이지를 다시 그리므로(revalidatePath) 창만 닫으면 상태가 "취소"로 바뀐다
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        {single ? (
          <Button variant="outline" size="sm" className="self-start rounded-md">
            이 상품만 취소
          </Button>
        ) : (
          <Button variant="outline" className="h-11 rounded-md px-5 text-base">
            예약 취소
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single ? "이 상품을 취소할까요?" : "예약을 취소할까요?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single
              ? `주문 ${orderNo}에서 이 상품만 취소되고, 일정 플래너의 예약 항목도 함께 지워져요.`
              : `주문 ${orderNo}에서 취소할 수 있는 상품이 모두 취소되고, 일정 플래너의 예약 항목도 함께 지워져요.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <table className="w-full text-sm">
          <caption className="sr-only">상품별 환불 예정액</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col" className="pb-2 font-medium">
                상품
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                환불
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.title}>
                <td className="py-2 pr-3">
                  <span className="block">{l.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.pending
                      ? "확정 대기 · 전액 환불"
                      : `이용 ${l.daysBefore}일 전 · ${l.refundRate}% 환불`}
                  </span>
                </td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {formatKrw(l.refundAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <th scope="row" className="pt-3 text-left font-semibold">
                환불 예정액
              </th>
              <td className="pt-3 text-right text-lg font-semibold tabular-nums">
                {formatKrw(totalRefund)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="text-xs text-muted-foreground">모의 결제라 실제 환불은 일어나지 않아요.</p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          {/* AlertDialogAction은 누르면 바로 닫히므로, 결과를 기다리는 일반 버튼을 쓴다 */}
          {/* shadcn destructive 변형(옅은 배경)은 다크 모드 대비 4.48:1 → 채운 빨강으로 (axe color-contrast) */}
          <Button
            onClick={confirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "취소하는 중…" : "예약 취소하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
