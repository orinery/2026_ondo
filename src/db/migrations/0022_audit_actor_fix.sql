-- Custom SQL migration file, put your code below! --
-- 감사 로그 보정: 행위자 역할을 "계정의 현재 역할"이 아니라 "그 동작을 한 자격"으로 남긴다.
-- 파트너 계정도 고객으로 구매·취소할 수 있어, 결제와 주문 주인의 취소는 계정 역할과 관계없이 customer다.
--   1) write_audit에 역할 지정 인자(p_role)를 더한다 (시그니처가 바뀌어 지우고 다시 만든다)
--   2) 주문 결제·주문 항목 트리거가 자격을 넘긴다
--   3) 권한

-- ─── 1) 기록 헬퍼 ─────────────────────────────────────────────────────────
drop function public.write_audit(text, uuid, uuid, text, jsonb, jsonb, text, boolean);
--> statement-breakpoint
create function public.write_audit(
  p_entity text,
  p_entity_id uuid,
  p_order_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_system boolean default false,
  p_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := case when p_system then null else auth.uid() end;
  v_role text := p_role;
begin
  if v_actor is null then
    v_role := 'system';
  elsif v_role is null then
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

-- ─── 2) 트리거 함수 ───────────────────────────────────────────────────────
-- 결제는 항상 고객 자격
create or replace function public.audit_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    'order', new.id, new.id, 'order.paid', null,
    jsonb_build_object('total_amount', new.total_amount),
    null, false, 'customer'
  );
  return null;
end;
$$;
--> statement-breakpoint

-- 주문 주인이 바꾼 상태(취소)는 고객 자격, 그 밖은 계정 역할 (파트너 확정·거절·사용, 관리자 조치)
create or replace function public.audit_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner boolean;
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(
      'order_item', new.id, new.order_id, 'item.' || new.status::text, null,
      jsonb_build_object('status', new.status, 'confirm_deadline', new.confirm_deadline),
      null, true
    );
  elsif new.status is distinct from old.status then
    select o.user_id = auth.uid() into v_owner from public.orders o where o.id = new.order_id;
    perform public.write_audit(
      'order_item', new.id, new.order_id, 'item.' || new.status::text,
      jsonb_build_object('status', old.status, 'refund_amount', old.refund_amount),
      jsonb_build_object('status', new.status, 'refund_amount', new.refund_amount),
      case when new.status::text = 'rejected' then new.reject_reason end,
      new.status::text = 'expired',
      case when coalesce(v_owner, false) then 'customer' end
    );
  end if;
  return null;
end;
$$;
--> statement-breakpoint

-- ─── 3) 권한 ───────────────────────────────────────────────────────────
revoke execute on function public.write_audit(text, uuid, uuid, text, jsonb, jsonb, text, boolean, text) from public, anon, authenticated;
