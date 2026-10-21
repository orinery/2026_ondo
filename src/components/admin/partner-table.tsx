import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { partnerStatusLabel } from "@/lib/constants/taxonomy";
import type { PartnerRow } from "@/lib/data/partners";
import { formatTimestamp } from "@/lib/format";

import { PartnerStatusAction } from "./partner-status-action";

/** 관리자: 파트너 목록 표 (계정이 연결된 파트너만 이용 정지/해제할 수 있다) */
export function PartnerTable({ partners }: { partners: PartnerRow[] }) {
  return (
    // 767 이하에서는 표가 가로로 스크롤된다 (Table 컨테이너의 overflow-x-auto)
    <div className="rounded-xl border bg-card">
      <Table className="min-w-[44rem]">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">파트너</TableHead>
            <TableHead>담당자 · 연락처</TableHead>
            <TableHead className="text-right">상품</TableHead>
            <TableHead className="text-right">수수료</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="pr-4 text-right">
              <span className="sr-only">관리</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="pl-4">
                <span className="block font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.hasOwner ? "계정 연결됨" : "계정 없음 (직영·데모)"} ·{" "}
                  {formatTimestamp(p.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <span className="block">{p.contactName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{p.contactPhone}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.productCount}개</TableCell>
              <TableCell className="text-right tabular-nums">{p.commissionRate}%</TableCell>
              <TableCell>
                {/* 정지: 옅은 빨강 배경은 다크 모드 대비가 부족해 테두리 + 글자색으로 표시 */}
                <Badge
                  variant={p.status === "active" ? "secondary" : "outline"}
                  className={
                    p.status === "suspended" ? "border-destructive/50 text-destructive" : undefined
                  }
                >
                  {partnerStatusLabel(p.status)}
                </Badge>
              </TableCell>
              <TableCell className="pr-4 text-right">
                {/* 계정이 없는 파트너는 정지할 대상(로그인)이 없다 */}
                {p.hasOwner && (
                  <PartnerStatusAction partnerId={p.id} name={p.name} status={p.status} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
