-- Custom SQL migration file, put your code below! --
-- 판매 중지·파트너 정지·사유 2/2: 0026(products.suspended_kind)에 이어
--   1) 기존 판매 중지 상품 종류 채우기 + 중지 사유와 종류가 함께 있도록 제약
--   2) 상품 판매 중지: 종류 구분(정보 수정 필요 / 운영 불가·위험 → 기존 예약 전액 환불 취소), 재개도 사유 필수
--   3) 파트너 이용 정지: 판매 중 상품 일괄 중지, 해제하면 그 상품만 재개, 사유 필수
--   4) 리뷰 신고 기각·숨김·숨김 해제에 사유 필수 (감사 로그에 남김)
--   5) 영향 미리보기 (확인 창용)
--   6) 권한
-- 시그니처가 바뀌는 함수는 지우고 다시 만든다 (옛 시그니처를 부르는 배포본은 앱을 배포할 때까지 실패한다)

-- ─── 1) 기존 데이터 · 제약 ────────────────────────────────────────────────
update public.products set suspended_kind = 'info_fix'
where suspended_reason is not null and suspended_kind is null;
--> statement-breakpoint
alter table public.products add constraint products_suspension_kind
  check ((suspended_reason is null) = (suspended_kind is null));
--> statement-breakpoint

-- ─── 2) 상품 판매 중지 / 재개 ─────────────────────────────────────────────
drop function public.admin_set_product_suspension(uuid, text);
--> statement-breakpoint
-- 중지: info_fix = 신규 판매만 막는다 / unsafe = 그 상품의 이용 전 예약(확정 대기·확정, 이용일 오늘 이후)을 전액 환불로 함께 취소.
-- 재개: 사유를 감사 로그에 남긴다. 파트너 이용 정지로 중지된 상품도 개별로 재개할 수 있다.
-- 돌려주는 값 = 함께 취소한 예약 항목 수
create function public.admin_set_product_suspension(
  p_product_id uuid,
  p_suspend boolean,
  p_kind text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_item record;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_reason is null or char_length(v_reason) > 100 then
    raise exception 'invalid_suspend_reason';
  end if;
  if p_suspend and (p_kind is null or p_kind not in ('info_fix', 'unsafe')) then
    raise exception 'invalid_suspend_kind';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id) then
    raise exception 'not_found';
  end if;

  perform set_config('ondo.audit_reason', v_reason, true);
  if not p_suspend then
    update public.products
    set suspended_reason = null, suspended_kind = null, suspended_at = null
    where id = p_product_id;
    return 0;
  end if;

  update public.products
  set suspended_reason = v_reason,
      suspended_kind = p_kind::public.suspension_kind,
      suspended_at = now()
  where id = p_product_id;

  if p_kind = 'unsafe' then
    perform set_config('ondo.audit_reason_code', 'product_unsafe', true);
    -- 주문 → 항목 순서로 잠근다 (고객 취소·운영자 취소와 같은 순서)
    for v_item in
      select oi.id, oi.order_id
      from public.order_items oi
      where oi.product_id = p_product_id
        and oi.status::text in ('pending', 'confirmed')
        and oi.use_date >= public.seoul_today()
      order by oi.order_id, oi.id
    loop
      perform 1 from public.orders o where o.id = v_item.order_id for update;
      perform 1 from public.order_items oi
      where oi.id = v_item.id and oi.status::text in ('pending', 'confirmed')
      for update;
      if found then
        perform public.release_item(
          v_item.id, 'cancelled',
          (select oi.subtotal from public.order_items oi where oi.id = v_item.id),
          '판매 중지(운영 불가) — ' || v_reason
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end if;
  return v_count;
end;
$$;
--> statement-breakpoint

-- ─── 3) 파트너 이용 정지 / 해제 ───────────────────────────────────────────
drop function public.admin_set_partner_status(uuid, text);
--> statement-breakpoint
-- 정지: my_partner_id()가 null이 되어 파트너 센터가 막히고, 아직 중지되지 않은 그 파트너 상품을 모두
--       partner_suspended로 중지한다 (정지된 파트너 상품이 계속 팔리지 않게).
-- 해제: partner_suspended로 중지된 상품만 다시 연다 (관리자가 따로 중지한 상품은 그대로).
-- 이미 받은 예약은 그대로다. 돌려주는 값 = 중지·재개한 상품 수
create function public.admin_set_partner_status(p_partner_id uuid, p_status text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status';
  end if;
  if v_reason is null or char_length(v_reason) > 200 then
    raise exception 'invalid_status_reason';
  end if;

  perform set_config('ondo.audit_reason', v_reason, true);
  update public.partners set status = p_status::public.partner_status where id = p_partner_id;
  if not found then
    raise exception 'not_found';
  end if;

  if p_status = 'suspended' then
    update public.products
    set suspended_reason = '파트너 이용 정지',
        suspended_kind = 'partner_suspended',
        suspended_at = now()
    where partner_id = p_partner_id and suspended_reason is null;
  else
    update public.products
    set suspended_reason = null, suspended_kind = null, suspended_at = null
    where partner_id = p_partner_id and suspended_kind = 'partner_suspended';
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
--> statement-breakpoint

-- ─── 4) 리뷰 신고 처리 · 숨김 해제 ─────────────────────────────────────────
drop function public.resolve_review_report(uuid, text);
--> statement-breakpoint
-- 신고 처리: dismiss = 기각, hide = 리뷰 숨김 + 그 리뷰의 대기 중 신고를 모두 처리 완료로. 사유는 감사 로그에
create function public.resolve_review_report(p_report_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_review uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_action not in ('dismiss', 'hide') then
    raise exception 'invalid_status';
  end if;
  if v_note is null or char_length(v_note) > 200 then
    raise exception 'invalid_note';
  end if;

  select rr.review_id, rr.status::text into v_review, v_status
  from public.review_reports rr
  where rr.id = p_report_id
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status <> 'pending' then
    raise exception 'not_pending';
  end if;

  perform set_config('ondo.audit_reason', v_note, true);
  if p_action = 'dismiss' then
    update public.review_reports
    set status = 'dismissed', handled_by = auth.uid(), handled_at = now()
    where id = p_report_id;
    -- 기각은 리뷰가 바뀌지 않아 트리거가 없다 → 직접 남긴다
    perform public.write_audit('review', v_review, null, 'review.report_dismissed');
  else
    update public.reviews set hidden_at = now() where id = v_review and hidden_at is null;
    update public.review_reports
    set status = 'actioned', handled_by = auth.uid(), handled_at = now()
    where review_id = v_review and status = 'pending';
  end if;
end;
$$;
--> statement-breakpoint

drop function public.admin_set_review_hidden(uuid, boolean);
--> statement-breakpoint
-- 리뷰 숨김/해제 (잘못 숨긴 경우 되살리기). 사유는 감사 로그에
create function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_reason is null or char_length(v_reason) > 200 then
    raise exception 'invalid_note';
  end if;
  perform set_config('ondo.audit_reason', v_reason, true);
  update public.reviews
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end
  where id = p_review_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
--> statement-breakpoint

-- ─── 5) 영향 미리보기 ─────────────────────────────────────────────────────
-- 상품: 이용 전 예약(확정 대기·확정, 이용일 오늘 이후) 수와 전액 환불 시 금액 — "운영 불가"로 중지하면 취소될 범위
create or replace function public.admin_product_impact(p_product_id uuid)
returns table (pending_count integer, confirmed_count integer, refund_total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select (count(*) filter (where oi.status::text = 'pending'))::integer,
         (count(*) filter (where oi.status::text = 'confirmed'))::integer,
         coalesce(sum(oi.subtotal), 0)::integer
  from public.order_items oi
  where oi.product_id = p_product_id
    and oi.status::text in ('pending', 'confirmed')
    and oi.use_date >= public.seoul_today();
end;
$$;
--> statement-breakpoint

-- 파트너: 정지하면 함께 중지될 상품 수 / 해제하면 다시 열릴 상품 수, 이용 전 예약 수
create or replace function public.admin_partner_impact(p_partner_id uuid)
returns table (open_products integer, partner_suspended_products integer, pending_count integer, confirmed_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select (select count(*) from public.products p
          where p.partner_id = p_partner_id and p.suspended_reason is null)::integer,
         (select count(*) from public.products p
          where p.partner_id = p_partner_id and p.suspended_kind = 'partner_suspended')::integer,
         (select count(*) from public.order_items oi
          where oi.partner_id = p_partner_id and oi.status::text = 'pending'
            and oi.use_date >= public.seoul_today())::integer,
         (select count(*) from public.order_items oi
          where oi.partner_id = p_partner_id and oi.status::text = 'confirmed'
            and oi.use_date >= public.seoul_today())::integer;
end;
$$;
--> statement-breakpoint

-- ─── 6) 권한 ───────────────────────────────────────────────────────────
revoke execute on function public.admin_set_product_suspension(uuid, boolean, text, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_set_partner_status(uuid, text, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.resolve_review_report(uuid, text, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_set_review_hidden(uuid, boolean, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_product_impact(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_partner_impact(uuid) from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.admin_set_product_suspension(uuid, boolean, text, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_partner_status(uuid, text, text) to authenticated;
--> statement-breakpoint
grant execute on function public.resolve_review_report(uuid, text, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_product_impact(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_partner_impact(uuid) to authenticated;
