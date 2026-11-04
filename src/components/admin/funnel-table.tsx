import type { Funnel } from "@/lib/data/admin";
import { FUNNEL_STEPS } from "@/lib/funnel";

/** 비율 (소수 1자리). 기준이 0이면 "—" */
const rate = (part: number, base: number) =>
  base === 0 ? "—" : `${Math.round((part / base) * 1000) / 10}%`;

/**
 * 구매 퍼널 표 — 단계별 도달 방문 수와 전환율.
 * 숫자를 직접 읽는 게 중요한 데이터라 차트 대신 표로 그리고, 막대는 "상세 대비" 비율을 보조로 보여 준다.
 */
export function FunnelTable({ funnel }: { funnel: Funnel }) {
  const top = funnel.view_item.all;
  const empty = FUNNEL_STEPS.every((s) => funnel[s.key].all === 0);
  if (empty) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        이 기간에 수집된 방문이 없어요. 퍼널은 측정 기능을 배포한 뒤의 방문부터 기록돼요.
      </p>
    );
  }
  const wall = funnel.login_wall.all;
  const recovered = funnel.login_wall_recovered.all;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">구매 퍼널: 단계별 도달 방문 수와 전환율</caption>
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4 font-medium">
                단계
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                방문
              </th>
              <th scope="col" className="w-2/5 py-2 pr-4 font-medium">
                상세 대비
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                이전 단계 대비
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                모바일 · 데스크톱
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {FUNNEL_STEPS.map((s, i) => {
              const c = funnel[s.key];
              const prev = i === 0 ? null : funnel[FUNNEL_STEPS[i - 1]!.key].all;
              const share = top === 0 ? 0 : Math.min(c.all / top, 1);
              return (
                <tr key={s.key}>
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                    {s.label}
                  </th>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{c.all.toLocaleString()}</td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${share * 100}%` }}
                        />
                      </span>
                      <span className="w-14 text-right tabular-nums">{rate(c.all, top)}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {prev === null ? "—" : rate(c.all, prev)}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                    {c.mobile.toLocaleString()} · {c.desktop.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        로그인 필요로 막힌 방문 <span className="text-foreground tabular-nums">{wall}</span>회 중{" "}
        <span className="text-foreground tabular-nums">{recovered}</span>회(
        {rate(recovered, wall)})가 로그인 후 담기까지 이어졌어요. 이메일 인증 링크를 새 탭에서 열면
        다른 방문으로 세져 실제보다 낮게 나와요.
      </p>
      <p className="text-xs text-muted-foreground">
        방문 = 브라우저 탭 하나. 단계마다 그 단계에 도달한 방문 수를 세며, 순서는 강제하지 않아요
        (장바구니에서 바로 주문서로 간 방문도 주문서 단계에 포함).
      </p>
    </div>
  );
}
