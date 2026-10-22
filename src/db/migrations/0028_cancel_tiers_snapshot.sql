-- 생성 파일을 손봤다: 열을 바로 NOT NULL로 추가하면 기존 주문 항목 때문에 실패한다.
-- ① null 허용으로 추가 → ② 기존 항목 백필 → ③ 넣을 때 복사하는 트리거 → ④ NOT NULL (③이 먼저 있어야 그 사이 결제도 실패하지 않는다)
ALTER TABLE "order_items" ADD COLUMN "cancel_tiers" jsonb;--> statement-breakpoint

-- ② 기존 주문 항목: 지금 규정 구간으로 채운다.
--    규정을 고치는 화면이 지금까지 없었으므로(시드만 씀) 지금 구간 = 결제 당시 구간이다
update public.order_items oi
set cancel_tiers = coalesce((
  select jsonb_agg(
           jsonb_build_object('days_before', t.days_before, 'refund_rate', t.refund_rate)
           order by t.days_before desc
         )
  from public.cancellation_policy_tiers t
  where t.policy_code = oi.cancel_policy
), '[]'::jsonb)
where oi.cancel_tiers is null;--> statement-breakpoint

-- ③ 주문 항목을 넣을 때 그 규정의 구간을 복사한다 (place_order·시드·검증 스크립트 모두 이 경로)
create or replace function public.snapshot_cancel_tiers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cancel_tiers is null then
    new.cancel_tiers := coalesce((
      select jsonb_agg(
               jsonb_build_object('days_before', t.days_before, 'refund_rate', t.refund_rate)
               order by t.days_before desc
             )
      from public.cancellation_policy_tiers t
      where t.policy_code = new.cancel_policy
    ), '[]'::jsonb);
  end if;
  return new;
end;
$$;--> statement-breakpoint
create trigger order_items_snapshot_cancel_tiers before insert on public.order_items
  for each row execute function public.snapshot_cancel_tiers();--> statement-breakpoint
revoke execute on function public.snapshot_cancel_tiers() from public, anon, authenticated;--> statement-breakpoint

-- ④
ALTER TABLE "order_items" ALTER COLUMN "cancel_tiers" SET NOT NULL;
