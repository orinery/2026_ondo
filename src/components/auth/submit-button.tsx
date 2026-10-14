import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 제출 버튼 — 처리 중에는 비활성 + 스피너 (loading 상태) */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-12 rounded-md text-base font-semibold"
    >
      {pending ? (
        <>
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
