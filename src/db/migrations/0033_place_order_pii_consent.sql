-- Custom SQL migration file, put your code below! --
-- 예약 정보 파트너 제공 동의 2/2: 0032(orders.pii_share_agreed_at)에 이어 (A-04)
--   결제 함수에 "파트너 제공 동의" 인자를 더한다. 금액·좌석·중복 방지 로직(0012)은 그대로 두려고
--   기존 함수를 내부 전용(place_order_core)으로 이름만 바꾸고, 새 place_order가 동의를 확인한 뒤 부른다.
--   ⚠ 인자가 바뀌어 옛 앱(인자 7개)은 배포 전까지 결제가 실패한다 → 적용 후 바로 배포

-- ─── 1) 기존 결제 함수 → 내부 전용 ───────────────────────────────────────────
alter function public.place_order(uuid[], text, text, text, boolean, integer, uuid)
  rename to place_order_core;
--> statement-breakpoint
-- 동의 확인을 건너뛰고 직접 부를 수 없게 실행 권한을 뺀다 (새 place_order 안에서만)
revoke execute on function public.place_order_core(uuid[], text, text, text, boolean, integer, uuid)
  from public, anon, authenticated;
--> statement-breakpoint

-- ─── 2) 새 결제 함수 ─────────────────────────────────────────────────────
-- 취소 규정 동의(p_policy_agreed)와 예약 정보 파트너 제공 동의(p_pii_share_agreed)를 따로 받는다.
-- 동의 시각은 주문에 남긴다. 같은 중복 방지 키의 재시도는 core가 기존 주문번호를 돌려준다
create function public.place_order(
  p_cart_item_ids uuid[],
  p_booker_name text,
  p_booker_email text,
  p_booker_phone text,
  p_policy_agreed boolean,
  p_pii_share_agreed boolean,
  p_expected_total integer,
  p_idempotency_key uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_no text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if p_pii_share_agreed is not true then
    raise exception 'pii_share_not_agreed';
  end if;

  v_order_no := public.place_order_core(
    p_cart_item_ids, p_booker_name, p_booker_email, p_booker_phone,
    p_policy_agreed, p_expected_total, p_idempotency_key
  );

  update public.orders o
  set pii_share_agreed_at = coalesce(o.pii_share_agreed_at, now())
  where o.order_no = v_order_no and o.user_id = auth.uid();
  return v_order_no;
end;
$$;
--> statement-breakpoint

-- ─── 3) 권한 ───────────────────────────────────────────────────────────
revoke execute on function public.place_order(uuid[], text, text, text, boolean, boolean, integer, uuid)
  from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.place_order(uuid[], text, text, text, boolean, boolean, integer, uuid)
  to authenticated;
