"use client";

import { useState, useTransition } from "react";

import { addOrderMemo } from "@/actions/admin-orders";
import { FormField } from "@/components/form/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OrderMemo } from "@/lib/data/admin";
import { formatTimestamp } from "@/lib/format";

import { failureText } from "./application-actions";

/**
 * 관리자: 주문 CS 메모 (내부용). 고치거나 지울 수 없어 남긴 순서대로 기록이 된다.
 */
export function OrderMemos({
  orderNo,
  orderId,
  memos,
  headingId = "order-memos",
}: {
  orderNo: string;
  orderId: string;
  memos: OrderMemo[];
  headingId?: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `${headingId}-body`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addOrderMemo({ orderNo, orderId, body });
      if (!result.ok) return setError(failureText(result));
      setBody("");
    });
  };

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-5 text-sm">
      <h2 id={headingId} className="mb-4 font-semibold">
        CS 메모 <span className="font-normal text-muted-foreground">· 관리자만 봐요</span>
      </h2>
      {memos.length > 0 && (
        <ul className="mb-4 flex flex-col gap-3">
          {memos.map((m) => (
            <li key={m.id} className="flex flex-col gap-0.5">
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="text-muted-foreground tabular-nums">
                {m.authorName ?? "관리자"} ·{" "}
                <time dateTime={m.at}>{formatTimestamp(m.at, true)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <FormField
          id={fieldId}
          label="메모 남기기"
          error={error ?? undefined}
          hint={`${body.trim().length}/500자 · 남긴 메모는 고칠 수 없어요`}
        >
          <Textarea
            id={fieldId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="예: 10/22 고객 전화 — 픽업 장소 변경 요청, 파트너에게 전달함"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </FormField>
        <Button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="self-end rounded-md"
        >
          {pending ? "남기는 중…" : "메모 남기기"}
        </Button>
      </form>
    </section>
  );
}
