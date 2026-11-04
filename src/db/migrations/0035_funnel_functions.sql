-- Custom SQL migration file, put your code below! --
-- 구매 퍼널 측정 2/2: 0034(funnel_events 테이블)에 이어 (Quick Win Q4)
--   쓰기는 정해진 컬럼만 insert, 읽기는 관리자 집계 함수로만. 180일 지난 기록은 매일 지운다.

-- ─── 1) 권한: 누구나 기록만 (읽기·수정·삭제 없음) ─────────────────────────────
-- id·created_at은 기본값으로만 — 시각을 꾸며 넣을 수 없다
revoke all on public.funnel_events from anon, authenticated;
--> statement-breakpoint
grant insert (name, session_id, product_id, device) on public.funnel_events to anon, authenticated;
--> statement-breakpoint

-- ─── 2) 관리자 퍼널 집계 ─────────────────────────────────────────────────
-- 단계별로 "그 단계에 도달한 방문(session_id) 수"를 센다. 순서를 강제하지는 않는다
-- (상세를 거치지 않고 장바구니에서 바로 주문서로 가는 방문도 주문서 단계에 센다).
-- login_wall_recovered = 로그인 벽에 막힌 뒤 같은 방문에서 담기까지 간 수.
--   이메일 인증 링크를 새 탭에서 열면 다른 방문이 되므로 실제보다 적게 잡힌다.
create or replace function public.admin_funnel(p_from date, p_to date)
returns table (step text, sessions integer, mobile integer, desktop integer)
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
  with ev as (
    -- 한국 날짜 범위를 시각 범위로 바꿔 created_at 인덱스를 쓴다
    select e.name, e.session_id, e.device, e.created_at
    from public.funnel_events e
    where e.created_at >= (p_from::timestamp at time zone 'Asia/Seoul')
      and e.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul')
  ), recovered as (
    select w.session_id, w.device
    from ev w
    where w.name = 'login_wall'
      and exists (
        select 1 from ev a
        where a.session_id = w.session_id and a.name = 'add_to_cart' and a.created_at > w.created_at
      )
  ), tagged as (
    select ev.name as step_name, ev.session_id, ev.device from ev
    union all
    select 'login_wall_recovered', r.session_id, r.device from recovered r
  )
  select s.step_name,
         count(distinct t.session_id)::integer,
         (count(distinct t.session_id) filter (where t.device = 'mobile'))::integer,
         (count(distinct t.session_id) filter (where t.device = 'desktop'))::integer
  from unnest(array[
    'view_item', 'start_booking', 'add_to_cart', 'begin_checkout', 'purchase',
    'login_wall', 'login_wall_recovered'
  ]) with ordinality as s(step_name, ord)
  left join tagged t on t.step_name = s.step_name
  group by s.step_name, s.ord
  order by s.ord;
end;
$$;
--> statement-breakpoint
revoke execute on function public.admin_funnel(date, date) from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.admin_funnel(date, date) to authenticated;
--> statement-breakpoint

-- ─── 3) 보관 기간: 180일 (매일 한국 시각 03:30) ──────────────────────────────
-- 같은 이름이면 일정이 갱신된다 (다시 실행해도 작업이 늘지 않음)
select cron.schedule(
  'purge-funnel-events',
  '30 18 * * *',
  $$delete from public.funnel_events where created_at < now() - interval '180 days'$$
);
