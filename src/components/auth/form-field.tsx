"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * 라벨 + 입력 + 안내/에러 문구 (명세 4.5: 입력 높이 48)
 * 에러는 aria-invalid + aria-describedby로 스크린리더에도 연결한다.
 */
export function FormField({ label, error, hint, className, ...inputProps }: FormFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={message ? messageId : undefined}
        // 16px: iOS에서 입력 시 화면이 확대되지 않게 한다
        className={cn(
          "h-12 rounded-md bg-card px-4 text-base md:text-base dark:bg-card",
          className,
        )}
        {...inputProps}
      />
      {message && (
        <p
          id={messageId}
          className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}
