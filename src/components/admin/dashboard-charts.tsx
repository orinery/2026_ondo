"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { BreakdownRow, DailyStat } from "@/lib/data/admin";
import { formatKrw } from "@/lib/format";

// 색은 globals.css의 --chart-* 토큰(= 명세 시맨틱 색)을 쓴다 — 다크 모드에서 함께 바뀐다
const dailyConfig = {
  gross: { label: "결제액", color: "var(--chart-1)" },
  refunds: { label: "환불액", color: "var(--chart-3)" },
} satisfies ChartConfig;

const breakdownConfig = {
  revenue: { label: "매출", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** 만 원 단위 축 라벨: 1,250,000 → "125만" */
const tenThousand = (v: number) =>
  v === 0 ? "0" : `${Math.round(v / 10000).toLocaleString("ko-KR")}만`;
const shortDay = (ymd: string) => `${Number(ymd.slice(5, 7))}.${Number(ymd.slice(8, 10))}`;

/**
 * 일별 결제·환불 막대 차트.
 * 차트는 그림이라 스크린리더용으로 같은 숫자를 숨긴 표로도 제공한다 (role="img" + 설명 + sr-only 표).
 */
export function DailyChart({ data, title }: { data: DailyStat[]; title: string }) {
  const total = data.reduce((n, d) => n + d.gross, 0);
  return (
    <figure className="flex flex-col gap-3">
      <ChartContainer
        config={dailyConfig}
        className="aspect-auto h-64 w-full"
        role="img"
        aria-label={`${title}: 기간 결제액 합계 ${formatKrw(total)}`}
      >
        <BarChart data={data} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis tickFormatter={tenThousand} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const day = payload?.[0]?.payload?.day;
                  return typeof day === "string" ? shortDay(day) : "";
                }}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">
                      {dailyConfig[name as keyof typeof dailyConfig]?.label}
                    </span>
                    <span className="font-medium tabular-nums">{formatKrw(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="gross" fill="var(--color-gross)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="refunds" fill="var(--color-refunds)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">주문</th>
            <th scope="col">결제액</th>
            <th scope="col">환불액</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.orders}</td>
              <td>{formatKrw(d.gross)}</td>
              <td>{formatKrw(d.refunds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** 도시별·종류별 매출 가로 막대 */
export function BreakdownChart({ data, title }: { data: BreakdownRow[]; title: string }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">이 기간에 판매가 없어요.</p>
    );
  }
  return (
    <figure className="flex flex-col gap-3">
      <ChartContainer
        config={breakdownConfig}
        className="aspect-auto w-full"
        style={{ height: Math.max(data.length * 40 + 24, 120) }}
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${formatKrw(d.revenue)}`).join(", ")}`}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={tenThousand} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={88} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">매출 · {item.payload?.items}건</span>
                    <span className="font-medium tabular-nums">{formatKrw(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">구분</th>
            <th scope="col">건수</th>
            <th scope="col">매출</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.items}</td>
              <td>{formatKrw(d.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
