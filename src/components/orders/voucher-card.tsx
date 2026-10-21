import QRCode from "qrcode";

import { formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 모바일 바우처 — 예약이 확정되면 발급된 코드와 QR (서버에서 그린다).
 * QR은 라이브러리로 모듈(칸) 배열만 만들고 SVG는 직접 그린다: 색을 currentColor로 두어 디자인 토큰을 따르게 하려고.
 * 스캐너는 "밝은 바탕에 어두운 칸"을 가장 잘 읽으므로 다크 모드에서도 그 방향을 유지한다.
 * 파트너는 코드를 입력해 사용 처리한다 (카메라 스캔 없음 — 사용자 확정).
 */
export function VoucherCard({
  code,
  title,
  useDate,
  startTime,
  people,
  className,
}: {
  code: string;
  title: string;
  useDate: string;
  startTime: string | null;
  people: number;
  className?: string;
}) {
  const qr = QRCode.create(code, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  // 어두운 칸마다 1×1 사각형 경로
  let d = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  // 읽기 쉽게 4자리씩 끊어 보여준다 (B362 D132 E0)
  const spaced = code.replace(/(.{4})(?=.)/g, "$1 ");

  return (
    <article
      aria-label={`${title} 바우처`}
      className={cn("flex items-center gap-4 rounded-xl border bg-card p-4", className)}
    >
      <div className="rounded-md bg-card p-1.5 text-card-foreground dark:bg-foreground dark:text-background">
        <svg
          viewBox={`-2 -2 ${size + 4} ${size + 4}`}
          role="img"
          aria-label={`바우처 코드 ${code}의 QR 코드`}
          className="size-28 md:size-32"
          shapeRendering="crispEdges"
        >
          <path d={d} fill="currentColor" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-semibold text-primary">모바일 바우처</p>
        <p className="font-kr font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">
          {formatUseDate(useDate)}
          {startTime && ` ${startTime}`} · {people}명
        </p>
        <p className="mt-1 text-lg font-semibold tracking-wider tabular-nums">
          <span className="sr-only">바우처 코드 </span>
          {spaced}
        </p>
        <p className="text-xs text-muted-foreground">현장에서 코드나 QR을 보여 주세요.</p>
      </div>
    </article>
  );
}
