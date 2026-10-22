-- Custom SQL migration file, put your code below! --
-- 감사 로그 2/2: 0020(audit_logs)에 이어
--   1) 기록 헬퍼 write_audit (내부 전용 — 실행 권한 없음)
--   2) 트리거: 주문 결제, 주문 항목 생성·상태 변경, 상품 판매 중지/재개, 파트너 정지/해제, 정산 완료, 리뷰 숨김/해제
--   3) 기존 주문 이력 백필 (타임스탬프 열에서 추론)
--   4) 권한

-- ─── 1) 기록 헬퍼 ─────────────────────────────────────────────────────────
-- 행위자 = auth.uid()의 역할 (없으면 system). 사유는 인자로 받거나,
-- 관리자 함수가 set_config('ondo.audit_reason_code' / 'ondo.audit_reason', …, true)로 넘긴 값을 쓴다 (트랜잭션 안에서만 유효)
create or replace function public.write_audit(
  p_entity text,
  p_entity_id uuid,
  p_order_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_system boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := case when p_system then null else auth.uid() end;
  v_role text;
begin
  if v_actor is not null then
    select p.role::text into v_role from public.profiles p where p.id = v_actor;
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, entity, entity_id, order_id, action, reason_code, reason, before, after
  )
  values (
    v_actor,
    coalesce(v_role, 'system'),
    p_entity,
    p_entity_id,
    p_order_id,
    p_action,
    nullif(current_setting('ondo.audit_reason_code', true), ''),
    coalesce(p_reason, nullif(current_setting('ondo.audit_reason', true), '')),
    p_before,
    p_after
  );
end;
$$;
--> statement-breakpoint

-- ─── 2) 트리거 ───────────────────────────────────────────────────────────
-- 주문 결제 (place_order가 만든다 → 행위자 = 고객)
create or replace function public.audit_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    'order', new.id, new.id, 'order.paid', null,
    jsonb_build_object('total_amount', new.total_amount)
  );
  return null;
end;
$$;
--> statement-breakpoint
create trigger orders_audit after insert on public.orders
  for each row execute function public.audit_order();
--> statement-breakpoint

-- 주문 항목: 만들 때(즉시 확정 / 확정 대기)는 system, 상태가 바뀌면 그 행위자.
-- 기한 초과 만료는 화면을 연 사람이 실행해도 system으로 남긴다
create or replace function public.audit_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(
      'order_item', new.id, new.order_id, 'item.' || new.status::text, null,
      jsonb_build_object('status', new.status, 'confirm_deadline', new.confirm_deadline),
      null, true
    );
  elsif new.status is distinct from old.status then
    perform public.write_audit(
      'order_item', new.id, new.order_id, 'item.' || new.status::text,
      jsonb_build_object('status', old.status, 'refund_amount', old.refund_amount),
      jsonb_build_object('status', new.status, 'refund_amount', new.refund_amount),
      case when new.status::text = 'rejected' then new.reject_reason end,
      new.status::text = 'expired'
    );
  end if;
  return null;
end;
$$;
--> statement-breakpoint
create trigger order_items_audit after insert or update of status on public.order_items
  for each row execute function public.audit_order_item();
--> statement-breakpoint

-- 상품 판매 중지/재개 (관리자)
create or replace function public.audit_product_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.suspended_reason is distinct from old.suspended_reason then
    perform public.write_audit(
      'product', new.id, null,
      case when new.suspended_reason is null then 'product.resume' else 'product.suspend' end,
      jsonb_build_object('suspended_reason', old.suspended_reason),
      jsonb_build_object('suspended_reason', new.suspended_reason),
      new.suspended_reason
    );
  end if;
  return null;
end;
$$;
--> statement-breakpoint
create trigger products_audit_suspension after update of suspended_reason on public.products
  for each row execute function public.audit_product_suspension();
--> statement-breakpoint

-- 파트너 이용 정지/해제 (관리자)
create or replace function public.audit_partner_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.write_audit(
      'partner', new.id, null, 'partner.' || new.status::text,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return null;
end;
$$;
--> statement-breakpoint
create trigger partners_audit_status after update of status on public.partners
  for each row execute function public.audit_partner_status();
--> statement-breakpoint

-- 정산 완료 (관리자) — settlements는 (partner_id, month)가 키라 entity_id = partner_id
create or replace function public.audit_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    'settlement', new.partner_id, null, 'settlement.settle', null,
    jsonb_build_object('month', new.month, 'item_count', new.item_count, 'payout', new.payout)
  );
  return null;
end;
$$;
--> statement-breakpoint
create trigger settlements_audit after insert on public.settlements
  for each row execute function public.audit_settlement();
--> statement-breakpoint

-- 리뷰 숨김/해제 (관리자)
create or replace function public.audit_review_hidden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hidden_at is distinct from old.hidden_at then
    perform public.write_audit(
      'review', new.id, null,
      case when new.hidden_at is null then 'review.unhide' else 'review.hide' end
    );
  end if;
  return null;
end;
$$;
--> statement-breakpoint
create trigger reviews_audit_hidden after update of hidden_at on public.reviews
  for each row execute function public.audit_review_hidden();
--> statement-breakpoint

-- ─── 3) 기존 주문 이력 백필 ─────────────────────────────────────────────────
-- 이 마이그레이션 전에는 경로가 하나씩뿐이라 행위자를 추론할 수 있다:
-- 결제·취소 = 고객, 확정 대기 등록·즉시 확정·만료 = system, 파트너 확정·거절·사용 = 파트너(계정 미상 → actor_id null)
insert into public.audit_logs (actor_id, actor_role, entity, entity_id, order_id, action, reason, after, created_at)
select o.user_id, 'customer', 'order', o.id, o.id, 'order.paid', null,
       jsonb_build_object('total_amount', o.total_amount, 'backfilled', true), o.paid_at
from public.orders o
union all
-- 파트너 확정 상품: 결제와 함께 확정 대기
select null, 'system', 'order_item', oi.id, oi.order_id, 'item.pending', null,
       jsonb_build_object('status', 'pending', 'confirm_deadline', oi.confirm_deadline, 'backfilled', true), o.paid_at
from public.order_items oi
join public.orders o on o.id = oi.order_id
where oi.confirm_deadline is not null
union all
-- 확정: 확정 대기였으면 파트너, 아니면 결제와 함께 즉시 확정
select null,
       case when oi.confirm_deadline is null then 'system' else 'partner' end,
       'order_item', oi.id, oi.order_id, 'item.confirmed', null,
       jsonb_build_object('status', 'confirmed', 'backfilled', true), oi.confirmed_at
from public.order_items oi
where oi.confirmed_at is not null
union all
select null, 'partner', 'order_item', oi.id, oi.order_id, 'item.rejected', oi.reject_reason,
       jsonb_build_object('status', 'rejected', 'refund_amount', oi.refund_amount, 'backfilled', true), oi.rejected_at
from public.order_items oi
where oi.rejected_at is not null
union all
select null, 'partner', 'order_item', oi.id, oi.order_id, 'item.used', null,
       jsonb_build_object('status', 'used', 'backfilled', true), oi.used_at
from public.order_items oi
where oi.used_at is not null
union all
-- release_item은 취소·만료 모두 cancelled_at을 남긴다 → 상태로 나눈다
select case when oi.status::text = 'cancelled' then o.user_id end,
       case when oi.status::text = 'cancelled' then 'customer' else 'system' end,
       'order_item', oi.id, oi.order_id, 'item.' || oi.status::text, null,
       jsonb_build_object('status', oi.status, 'refund_amount', oi.refund_amount, 'backfilled', true), oi.cancelled_at
from public.order_items oi
join public.orders o on o.id = oi.order_id
where oi.cancelled_at is not null and oi.status::text in ('cancelled', 'expired');
--> statement-breakpoint

-- ─── 4) 권한 ───────────────────────────────────────────────────────────
revoke all on public.audit_logs from anon, authenticated;
--> statement-breakpoint
-- 읽기는 RLS(관리자만)가 거른다. 쓰기는 트리거·함수만
grant select on public.audit_logs to authenticated;
--> statement-breakpoint

revoke execute on function public.write_audit(text, uuid, uuid, text, jsonb, jsonb, text, boolean) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_order() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_order_item() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_product_suspension() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_partner_status() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_settlement() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.audit_review_hidden() from public, anon, authenticated;
