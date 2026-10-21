"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useActionState, useState } from "react";

import { markVoucherUsed, type VoucherState } from "@/actions/partner-bookings";
import { FormField } from "@/components/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUseDate } from "@/lib/format";

const INITIAL: VoucherState = { error: null, used: null };

/**
 * 파트너: 바우처 사용 처리 — 고객이 보여준 10자리 코드를 입력한다 (카메라 스캔 없음, 사용자 확정).
 * 하이픈·공백·소문자로 입력해도 DB가 정리해서 찾는다.
 */
export function VoucherForm() {
  const [state, formAction, pending] = useActionState(markVoucherUsed, INITIAL);
  // React 19는 액션이 끝나면 폼을 초기화한다 — 실패했을 때 입력이 지워지지 않게 값을 들고 있는다
  const [code, setCode] = useState("");

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
        <FormField
          id="voucher-code"
          label="바우처 코드"
          error={state.error ?? undefined}
          hint="예: B362 D132 E0"
          className="flex-1"
        >
          <Input
            id="voucher-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={16}
            className="h-12 text-lg tracking-wider uppercase"
            aria-invalid={Boolean(state.error) || undefined}
            aria-describedby={state.error ? "voucher-code-error" : undefined}
          />
        </FormField>
        <Button type="submit" disabled={pending} className="h-12 rounded-md px-6 font-semibold">
          {pending ? "확인하는 중…" : "사용 처리"}
        </Button>
      </form>

      {state.used && (
        <div role="status" className="flex gap-3 rounded-xl border bg-card p-5">
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-base font-semibold">이용 완료로 처리했어요</p>
            <p>{state.used.productTitle}</p>
            <p className="text-muted-foreground">
              {formatUseDate(state.used.useDate)} · {state.used.people}명 · 예약자{" "}
              {state.used.bookerName}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
