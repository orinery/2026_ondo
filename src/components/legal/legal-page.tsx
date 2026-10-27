import { InfoIcon } from "lucide-react";
import Link from "next/link";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/**
 * 약관·개인정보 처리방침 공용 틀 — 목차 + 조항.
 * 포트폴리오 예시 문안이라 맨 위에 "법적 효력 없음"을 항상 보여 준다 (사용자 확정).
 */
export function LegalPage({
  eyebrow,
  title,
  effectiveDate,
  sections,
  related,
}: {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return (
    <div className="container py-10 md:py-14">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="font-display text-2xl text-muted-foreground italic">{eyebrow}</p>
          <h1 className="font-kr text-4xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">시행일 {effectiveDate}</p>
        </header>

        <p
          role="note"
          className="flex items-start gap-2 rounded-xl border border-warning/50 bg-card px-4 py-3 text-sm"
        >
          <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            포트폴리오 프로젝트의 <strong className="font-semibold">예시 문안</strong>이에요. 실제
            서비스가 아니며 법적 효력이 없어요. 내용은 이 사이트에 구현된 기능에 맞춰 썼어요.
          </span>
        </p>

        <nav aria-label="목차" className="rounded-xl border bg-card p-5 text-sm">
          <ol className="grid gap-1.5 md:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
            <h2 id={`${s.id}-title`} className="mb-3 font-kr text-xl font-semibold">
              {i + 1}. {s.title}
            </h2>
            <div className="flex flex-col gap-3 leading-7 text-foreground/90 [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pr-3 [&_th]:pb-2 [&_th]:text-left [&_th]:font-semibold">
              {s.body}
            </div>
          </section>
        ))}

        <p className="border-t pt-6 text-sm text-muted-foreground">
          함께 보기:{" "}
          <Link href={related.href} className="font-semibold text-primary hover:underline">
            {related.label}
          </Link>
        </p>
      </article>
    </div>
  );
}
