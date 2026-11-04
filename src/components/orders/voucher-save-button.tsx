"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type VoucherImage = {
  code: string;
  spacedCode: string; // "B362 D132 E0"
  title: string;
  when: string; // "11월 21일 (토) 08:00 · 3명"
  qrPath: string; // 서버에서 만든 QR 칸 경로 (SVG path, 1칸 = 1)
  qrSize: number; // 한 변의 칸 수
};

// 이미지는 화면 모드와 상관없이 흰 바탕 — 현장 스캐너·캡처 공유에 가장 무난하다 (light 토큰 값)
const INK = "#1b1a17";
const MUTED = "#5d584f";
const BRAND = "#3b6447";
const WIDTH = 720;
const PAD = 56;
const SCALE = 2; // 고해상도 화면에서도 글자가 흐리지 않게 2배로 그린다

/**
 * 바우처를 PNG로 저장 (Quick Win Q8) — 데이터가 안 터지는 현장에서도 앨범에서 바로 꺼내 보여 줄 수 있게.
 * 캔버스에 직접 그린다 (외부 라이브러리 없이): 흰 바탕, 상품명, 이용일·인원, QR, 코드.
 * 휴대폰(터치 기기)은 공유 시트가 있으면 그걸 띄워 "이미지 저장"으로 앨범에 넣게 하고, 아니면 파일로 내려받는다.
 */
export function VoucherSaveButton(props: VoucherImage) {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  const save = async () => {
    setState("saving");
    try {
      const blob = await drawVoucher(props);
      const name = `yeoun-voucher-${props.code}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: props.title });
        } catch (e) {
          // 사용자가 공유 시트를 닫은 것은 실패가 아니다
          if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mt-1 flex flex-col items-start gap-1 print:hidden">
      <Button
        type="button"
        variant="outline"
        onClick={save}
        disabled={state === "saving"}
        className="h-9 rounded-md px-3 text-sm"
      >
        <DownloadIcon aria-hidden className="size-4" />
        {state === "saving" ? "저장하는 중…" : "이미지로 저장"}
      </Button>
      <p aria-live="polite" className="text-xs text-destructive">
        {state === "error" && "이미지를 만들지 못했어요. 화면을 캡처해 주세요."}
      </p>
    </div>
  );
}

/** 바우처 이미지를 그려 PNG Blob으로 */
async function drawVoucher({ spacedCode, title, when, qrPath, qrSize }: VoucherImage) {
  // 웹폰트가 다 받아진 뒤에 그려야 캔버스 글꼴이 화면과 같다
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  // 1) 높이를 정하려고 먼저 상품명 줄바꿈을 계산한다 (캔버스 크기를 바꾸면 그리기 상태가 초기화된다)
  const titleFont = `600 34px ${family}`;
  ctx.font = titleFont;
  const titleLines = wrap(ctx, title, WIDTH - PAD * 2);
  const modulePx = Math.floor(440 / (qrSize + 8)); // 정수 칸 크기 → 칸 경계가 흐려지지 않는다
  const qrPx = modulePx * (qrSize + 8); // 사방 4칸 여백(quiet zone) 포함
  const height =
    PAD + 30 + 24 + titleLines.length * 46 + 12 + 36 + 32 + qrPx + 32 + 56 + 24 + 30 + PAD;

  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "top";

  // 2) 머리글·상품명·이용일
  let y = PAD;
  ctx.fillStyle = BRAND;
  ctx.font = `600 22px ${family}`;
  ctx.fillText("여운 · 모바일 바우처", PAD, y);
  y += 30 + 24;
  ctx.fillStyle = INK;
  ctx.font = titleFont;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += 46;
  }
  y += 12;
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${family}`;
  ctx.fillText(when, PAD, y);
  y += 36 + 32;

  // 3) QR — 가운데, 칸 경로를 그대로 채운다
  const qrX = Math.round((WIDTH - qrPx) / 2);
  ctx.save();
  ctx.translate(qrX + modulePx * 4, y + modulePx * 4);
  ctx.scale(modulePx, modulePx);
  ctx.fillStyle = INK;
  ctx.fill(new Path2D(qrPath));
  ctx.restore();
  y += qrPx + 32;

  // 4) 코드·안내
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${family}`;
  ctx.letterSpacing = "4px";
  ctx.fillText(spacedCode, WIDTH / 2, y);
  ctx.letterSpacing = "0px";
  y += 56 + 24;
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${family}`;
  ctx.fillText("현장에서 코드나 QR을 보여 주세요.", WIDTH / 2, y);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

/** 폭에 맞춰 줄바꿈 — 띄어쓰기 단위로 끊고, 한 단어가 너무 길면 글자 단위로 끊는다 (최대 3줄, 넘치면 …) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  const push = (piece: string) => {
    const next = line ? `${line}${piece}` : piece.trimStart();
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = piece.trimStart();
    // 한 조각이 한 줄보다 길면 글자 단위로 자른다
    while (ctx.measureText(line).width > maxWidth) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  };
  for (const word of text.split(/(?=\s)/)) push(word);
  if (line) lines.push(line);
  if (lines.length > 3) {
    const kept = lines.slice(0, 3);
    kept[2] = `${kept[2]!.slice(0, -1)}…`;
    return kept;
  }
  return lines;
}
