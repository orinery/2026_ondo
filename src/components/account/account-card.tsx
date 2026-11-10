/** 계정 설정의 구역 카드 (제목 + 설명 + 내용) */
export function AccountCard({
  id,
  title,
  description,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={
        tone === "danger"
          ? "flex flex-col gap-5 rounded-xl border border-destructive/40 bg-card p-5 md:p-6"
          : "flex flex-col gap-5 rounded-xl border bg-card p-5 md:p-6"
      }
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {children}
    </section>
  );
}

/** 저장 결과 안내 (성공은 status, 실패는 alert) */
export function FormResult({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  return status === "success" ? (
    <p role="status" className="rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground">
      {message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
