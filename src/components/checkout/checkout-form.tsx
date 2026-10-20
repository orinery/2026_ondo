"use client";

import { CreditCardIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { placeOrder, type CheckoutState } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKrw } from "@/lib/format";

type CheckoutFormProps = {
  cartItemIds: string[];
  expectedTotal: number; // 서버가 현재 가격으로 계산한 총액 — DB가 같은지 다시 확인한다
  idempotencyKey: string; // 페이지를 그릴 때 만든 중복 결제 방지 키
  defaults: { name: string; email: string };
  itemCount: number;
  // 주문 상품 목록·취소 규정 등 서버에서 그린 본문
  children: React.ReactNode;
};

const INITIAL: CheckoutState = { error: null };

/**
 * 주문서 (하이파이에 없는 쇼핑몰 화면 — 기존 토큰·컴포넌트로 구성)
 * 폼 제출 → placeOrder(Server Action) → DB place_order → 완료 화면으로 이동.
 * 결제 버튼을 여러 번 눌러도 같은 중복 방지 키가 가므로 주문은 하나만 생긴다.
 */
export function CheckoutForm({
  cartItemIds,
  expectedTotal,
  idempotencyKey,
  defaults,
  itemCount,
  children,
}: CheckoutFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(placeOrder, INITIAL);
  const fe = state.fieldErrors ?? {};
  // 입력값을 상태로 들고 있는다(controlled). React 19는 폼 액션이 끝나면 폼을 초기화하는데,
  // 기본값만 준 입력(uncontrolled)은 검증 실패로 돌아와도 비워져 버린다 (휴대폰 번호가 사라지던 문제)
  const [name, setName] = useState(defaults.name);
  const [email, setEmail] = useState(defaults.email);
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      {cartItemIds.map((id) => (
        <input key={id} type="hidden" name="cartItemId" value={id} />
      ))}
      <input type="hidden" name="expectedTotal" value={expectedTotal} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="flex min-w-0 flex-col gap-10 lg:col-span-8">
        {children}

        <section aria-labelledby="booker-title" className="flex flex-col gap-4">
          <h2 id="booker-title" className="font-kr text-xl font-semibold">
            예약자 정보
          </h2>
          <p className="text-sm text-muted-foreground">
            예약 확인과 현지 연락에 쓰여요. 모든 항목을 입력해 주세요.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="bookerName" label="이름" error={fe.bookerName}>
              <Input
                id="bookerName"
                name="bookerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={30}
                aria-invalid={Boolean(fe.bookerName) || undefined}
                aria-describedby={fe.bookerName ? "bookerName-error" : undefined}
                className="h-12 text-base"
              />
            </Field>
            <Field id="bookerPhone" label="휴대폰 번호" error={fe.bookerPhone}>
              <Input
                id="bookerPhone"
                name="bookerPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="010-1234-5678"
                aria-invalid={Boolean(fe.bookerPhone) || undefined}
                aria-describedby={fe.bookerPhone ? "bookerPhone-error" : undefined}
                className="h-12 text-base"
              />
            </Field>
            <Field id="bookerEmail" label="이메일" error={fe.bookerEmail} className="md:col-span-2">
              <Input
                id="bookerEmail"
                name="bookerEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(fe.bookerEmail) || undefined}
                aria-describedby={fe.bookerEmail ? "bookerEmail-error" : undefined}
                className="h-12 text-base"
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="payment-title" className="flex flex-col gap-4">
          <h2 id="payment-title" className="font-kr text-xl font-semibold">
            결제 수단
          </h2>
          {/* 포트폴리오용 모의 결제 — 결제사 연동 없음 (사용자 확정) */}
          <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-primary bg-accent p-4 text-accent-foreground">
            <CreditCardIcon aria-hidden className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">모의 결제</p>
              <p className="text-sm">실제로 돈이 결제되지 않는 데모 결제예요.</p>
            </div>
          </div>
        </section>
      </div>

      <aside aria-label="결제" className="lg:col-span-4">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">결제 금액</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">상품 {itemCount}개</dt>
              <dd>{formatKrw(expectedTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">할인 · 수수료</dt>
              <dd>0원</dd>
            </div>
          </dl>
          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="font-medium">총 결제 금액</span>
            <span className="text-2xl font-semibold">{formatKrw(expectedTotal)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                name="policyAgreed"
                checked={agreed}
                onCheckedChange={(on) => setAgreed(on === true)}
                className="mt-0.5"
                aria-invalid={Boolean(fe.policyAgreed) || undefined}
                aria-describedby={fe.policyAgreed ? "policyAgreed-error" : undefined}
              />
              <span>
                주문 상품의 <span className="font-semibold">취소 규정</span>을 확인했고, 이에
                동의해요 (필수)
              </span>
            </label>
            {fe.policyAgreed && (
              <p id="policyAgreed-error" className="pl-6.5 text-sm text-destructive">
                {fe.policyAgreed}
              </p>
            )}
          </div>

          {state.error && (
            <div
              role="alert"
              // 옅은 빨강 배경(destructive/10)은 다크 모드에서 글자 대비가 4.48:1로 부족해 카드 배경 + 테두리로 표시
              className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-card p-3 text-sm text-destructive"
            >
              <p>{state.error}</p>
              {state.needsRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 self-start rounded-md"
                  onClick={() => router.refresh()}
                >
                  바뀐 내용 다시 불러오기
                </Button>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-md text-base font-semibold"
          >
            <LockIcon aria-hidden className="size-4" />
            {pending ? "결제하는 중…" : `${formatKrw(expectedTotal)} 결제하기`}
          </Button>
          <p className="text-xs text-muted-foreground">
            결제하면 이용일에 맞춰 나의 여행 &gt; 일정 플래너에 자동으로 추가돼요.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-sm font-medium">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
