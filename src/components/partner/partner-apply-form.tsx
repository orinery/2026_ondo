"use client";

import { useActionState, useState } from "react";

import { submitPartnerApplication, type ApplicationFormState } from "@/actions/partners";
import { FormField } from "@/components/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PartnerApplicationField } from "@/lib/validation/partner";

const INITIAL: ApplicationFormState = { ok: false, error: null };

/**
 * 파트너 신청서 (하이파이에 없는 화면 — 기존 토큰·컴포넌트로 구성)
 * 제출하면 관리자 검토 대기 상태가 되고, 페이지가 새로 그려지며 진행 상태 카드로 바뀐다.
 */
export function PartnerApplyForm({ defaults }: { defaults: { name: string; email: string } }) {
  const [state, formAction, pending] = useActionState(submitPartnerApplication, INITIAL);
  const fe = state.fieldErrors ?? {};
  // 검증 실패로 돌아와도 입력이 지워지지 않게 값을 상태로 들고 있는다 (React 19 폼 초기화 — 주문서와 같은 이유)
  const [values, setValues] = useState<Record<PartnerApplicationField, string>>({
    businessName: "",
    contactName: defaults.name,
    contactPhone: "",
    contactEmail: defaults.email,
    intro: "",
  });

  const bind = (field: PartnerApplicationField) => ({
    id: field,
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value })),
    "aria-invalid": Boolean(fe[field]) || undefined,
    "aria-describedby": fe[field] ? `${field}-error` : undefined,
  });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField
          id="businessName"
          label="상호 (파트너 이름)"
          error={fe.businessName}
          className="md:col-span-2"
          hint="상품 상세와 정산 내역에 표시돼요."
        >
          <Input {...bind("businessName")} maxLength={40} className="h-12 text-base" />
        </FormField>
        <FormField id="contactName" label="담당자 이름" error={fe.contactName}>
          <Input
            {...bind("contactName")}
            autoComplete="name"
            maxLength={30}
            className="h-12 text-base"
          />
        </FormField>
        <FormField id="contactPhone" label="연락처" error={fe.contactPhone}>
          <Input
            {...bind("contactPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="02-123-4567"
            className="h-12 text-base"
          />
        </FormField>
        <FormField
          id="contactEmail"
          label="이메일"
          error={fe.contactEmail}
          className="md:col-span-2"
        >
          <Input
            {...bind("contactEmail")}
            type="email"
            autoComplete="email"
            className="h-12 text-base"
          />
        </FormField>
        <FormField
          id="intro"
          label="소개"
          error={fe.intro}
          className="md:col-span-2"
          hint={`운영하는 상품과 지역을 알려 주세요. (${values.intro.trim().length}/500자)`}
        >
          <Textarea {...bind("intro")} rows={5} maxLength={500} className="text-base" />
        </FormField>
      </div>

      {state.error && (
        <p
          role="alert"
          // 다크 모드 대비 때문에 옅은 빨강 배경 대신 카드 배경 + 테두리 (주문서와 같은 방식)
          className="rounded-md border border-destructive/50 bg-card p-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 self-stretch rounded-md text-base font-semibold md:self-start md:px-8"
      >
        {pending ? "신청하는 중…" : "파트너 신청하기"}
      </Button>
    </form>
  );
}
