import { Label } from "@/components/ui/label";

/**
 * 라벨 + 입력 + 오류 문장 묶음. 오류 문장의 id는 `${id}-error` — 입력의 aria-describedby로 연결한다.
 * (주문서·파트너 신청·상품 등록 폼이 함께 쓴다)
 */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string; // 입력 아래 보조 설명 (오류가 있으면 오류가 대신 보인다)
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-sm font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
