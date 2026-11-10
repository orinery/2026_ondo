-- 회원 탈퇴 (계정 설정) — 약관·처리방침의 "언제든 탈퇴할 수 있다"를 실제로 제공한다.
--   1) account_deletion_blocker(): 지금 탈퇴할 수 없는 이유 (없으면 null) — 화면이 미리 알려 주는 용도
--   2) delete_my_account(): 같은 검사를 다시 한 뒤 본인 auth.users 행을 지운다
--
-- 지우면 일어나는 일 (기존 FK 설계):
--   profiles(cascade) → 찜·찜 폴더·여행·일정·장바구니·리뷰·신고(cascade)
--   orders.user_id·감사 로그 행위자·파트너 소유자 등은 set null → 주문 기록은 법령 보관용으로 남는다 (A-05, 0030)
-- 리뷰 사진(Storage)은 SQL로 지울 수 없어서 Server Action이 이 함수 전에 Storage API로 지운다.
--
-- 막는 경우 (사용자 확정):
--   - 파트너·관리자 계정: 상품·정산·운영 기록이 연결돼 있어 탈퇴 대신 문의
--   - 이용 예정 예약(확정 대기·확정, 이용일이 오늘 이후)이 남아 있을 때: 먼저 취소하거나 이용을 마친 뒤

create or replace function public.account_deletion_blocker()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role::text <> 'customer') then
    return 'account_has_role';
  end if;
  if exists (
    select 1
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.user_id = v_uid
      and i.status::text in ('pending', 'confirmed')
      and i.use_date >= public.seoul_today()
  ) then
    return 'has_upcoming_bookings';
  end if;
  return null;
end;
$$;
--> statement-breakpoint

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker text := public.account_deletion_blocker();
begin
  if v_blocker is not null then
    raise exception '%', v_blocker;
  end if;
  -- 인자 없이 auth.uid()만 쓴다 → 다른 사람 계정은 지울 수 없다
  delete from auth.users where id = auth.uid();
end;
$$;
--> statement-breakpoint

revoke all on function public.account_deletion_blocker() from public, anon;
--> statement-breakpoint
revoke all on function public.delete_my_account() from public, anon;
--> statement-breakpoint
grant execute on function public.account_deletion_blocker() to authenticated;
--> statement-breakpoint
grant execute on function public.delete_my_account() to authenticated;
