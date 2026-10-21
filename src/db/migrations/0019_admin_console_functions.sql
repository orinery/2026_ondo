-- Custom SQL migration file, put your code below! --
-- 관리자 콘솔 2/2: 0018(review_reports·reviews.hidden_at)에 이어
--   1) 리뷰 신고 검증 트리거, 숨긴 리뷰를 평점 집계에서 빼기
--   2) 관리자 함수: 신고 처리(기각·숨김), 리뷰 숨김 해제, 상품 판매 중지/재개
--   3) 대시보드 통계 함수 (관리자 전용)
--   4) 권한

-- ─── 1) 리뷰 신고 · 평점 ──────────────────────────────────────────────────
-- 본인 리뷰는 신고할 수 없다 (정책 with check에서 리뷰를 다시 읽으면 숨김 정책과 얽혀 트리거로 확인)
create or replace function public.check_review_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.reviews r where r.id = new.review_id) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.reviews r where r.id = new.review_id and r.user_id = new.reporter_id) then
    raise exception 'own_review';
  end if;
  if exists (
    select 1 from public.review_reports rr
    where rr.review_id = new.review_id and rr.reporter_id = new.reporter_id
  ) then
    raise exception 'already_reported';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger review_reports_check before insert on public.review_reports
  for each row execute function public.check_review_report();
--> statement-breakpoint

-- 평점 캐시: 숨긴 리뷰는 빼고 계산한다 (0005 함수 교체)
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce((
        select round(avg(r.rating)::numeric, 1) from public.reviews r
        where r.product_id = target and r.hidden_at is null
      ), 0),
      review_count = (
        select count(*) from public.reviews r where r.product_id = target and r.hidden_at is null
      )
  where p.id = target;
  return null;
end;
$$;
--> statement-breakpoint
-- 숨김·해제에도 다시 계산하도록 트리거 열 목록에 hidden_at을 더한다
drop trigger reviews_refresh_rating on public.reviews;
--> statement-breakpoint
create trigger reviews_refresh_rating after insert or update of rating, hidden_at or delete on public.reviews
  for each row execute function public.refresh_product_rating();
--> statement-breakpoint

-- ─── 2) 관리자 함수 ─────────────────────────────────────────────────────
-- 신고 처리: dismiss = 기각, hide = 리뷰 숨김 + 그 리뷰의 대기 중 신고를 모두 처리 완료로
create or replace function public.resolve_review_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_action not in ('dismiss', 'hide') then
    raise exception 'invalid_status';
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

  if p_action = 'dismiss' then
    update public.review_reports
    set status = 'dismissed', handled_by = auth.uid(), handled_at = now()
    where id = p_report_id;
  else
    update public.reviews set hidden_at = now() where id = v_review and hidden_at is null;
    update public.review_reports
    set status = 'actioned', handled_by = auth.uid(), handled_at = now()
    where review_id = v_review and status = 'pending';
  end if;
end;
$$;
--> statement-breakpoint

-- 숨긴 리뷰 되살리기 (잘못 숨긴 경우)
create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.reviews
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end
  where id = p_review_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
--> statement-breakpoint

-- 상품 판매 중지/재개: 사유가 있으면 중지, null·빈 문자열이면 재개.
-- 중지된 상품은 목록에서는 "판매 중지"로 보이고 예약은 막힌다(booking_error → unavailable). 이미 받은 예약은 그대로
create or replace function public.admin_set_product_suspension(p_product_id uuid, p_reason text)
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
  if v_reason is not null and char_length(v_reason) > 100 then
    raise exception 'invalid_reason';
  end if;
  update public.products
  set suspended_reason = v_reason,
      suspended_at = case when v_reason is null then null else now() end
  where id = p_product_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
--> statement-breakpoint

-- ─── 3) 대시보드 통계 (결제일 기준, 한국 날짜) ───────────────────────────────
-- 날짜별 주문 수·결제액·환불액 (주문이 없는 날도 0으로)
create or replace function public.admin_daily_stats(p_from date, p_to date)
returns table (day date, orders integer, gross integer, refunds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_range';
  end if;
  return query
  select d::date,
         count(o.id)::integer,
         coalesce(sum(o.total_amount), 0)::integer,
         coalesce(sum(o.refund_amount), 0)::integer
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.orders o on (o.paid_at at time zone 'Asia/Seoul')::date = d::date
  group by d
  order by d;
end;
$$;
--> statement-breakpoint

-- 도시별·종류별 판매 (거절·만료는 빼고, 매출 = 결제 - 환불)
create or replace function public.admin_breakdown(p_from date, p_to date, p_by text)
returns table (label text, items integer, revenue integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_by not in ('city', 'category') then
    raise exception 'invalid_status';
  end if;
  return query
  select case when p_by = 'city' then ci.name else p.category::text end,
         count(*)::integer,
         coalesce(sum(oi.subtotal - coalesce(oi.refund_amount, 0)), 0)::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  join public.cities ci on ci.id = p.city_id
  where (o.paid_at at time zone 'Asia/Seoul')::date between p_from and p_to
    and oi.status::text not in ('rejected', 'expired')
  group by 1
  order by 3 desc;
end;
$$;
--> statement-breakpoint

-- 요약 지표: 주문·항목·결제·환불, 취소된 항목(취소·거절·만료), 확정 대기, 처리할 신고·파트너 신청
create or replace function public.admin_kpis(p_from date, p_to date)
returns table (
  orders integer,
  items integer,
  gross integer,
  refunds integer,
  closed_items integer,
  pending_items integer,
  open_reports integer,
  pending_applications integer
)
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
  with paid as (
    select o.* from public.orders o
    where (o.paid_at at time zone 'Asia/Seoul')::date between p_from and p_to
  ), its as (
    select oi.* from public.order_items oi join paid on paid.id = oi.order_id
  )
  select (select count(*) from paid)::integer,
         (select count(*) from its)::integer,
         (select coalesce(sum(total_amount), 0) from paid)::integer,
         (select coalesce(sum(refund_amount), 0) from paid)::integer,
         (select count(*) from its where status::text in ('cancelled', 'rejected', 'expired'))::integer,
         (select count(*) from public.order_items x where x.status::text = 'pending')::integer,
         (select count(*) from public.review_reports r where r.status::text = 'pending')::integer,
         (select count(*) from public.partner_applications a where a.status::text = 'pending')::integer;
end;
$$;
--> statement-breakpoint

-- ─── 4) 권한 ───────────────────────────────────────────────────────────
revoke all on public.review_reports from anon, authenticated;
--> statement-breakpoint
-- 어떤 행인지는 RLS(본인·관리자)가 정한다. 신고 내용만 쓸 수 있다 (상태·처리자는 관리자 함수로)
grant select on public.review_reports to authenticated;
--> statement-breakpoint
grant insert (review_id, reason, detail) on public.review_reports to authenticated;
--> statement-breakpoint

revoke execute on function public.check_review_report() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.resolve_review_report(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_set_review_hidden(uuid, boolean) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_set_product_suspension(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_daily_stats(date, date) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_breakdown(date, date, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_kpis(date, date) from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.resolve_review_report(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_review_hidden(uuid, boolean) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_product_suspension(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_daily_stats(date, date) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_breakdown(date, date, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_kpis(date, date) to authenticated;
