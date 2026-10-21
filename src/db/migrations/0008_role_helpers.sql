-- Custom SQL migration file, put your code below! --
-- 파트너·관리자 1/3: 역할 판단 함수 (0009의 RLS 정책이 이 함수를 부르므로 먼저 만든다)
--
-- 왜 함수인가: 로그인 사용자는 모두 같은 DB 역할(authenticated)이라 GRANT로는 파트너·관리자를 나눌 수 없다.
--   행 정책에서 "이 사용자가 관리자인가 / 어느 파트너인가"를 물어야 한다.
-- 왜 security definer인가: 정책 안에서 profiles·partners를 다시 읽으면 그 테이블의 RLS가 또 적용되어
--   (partners 정책이 my_partner_id()를 부르는 식으로) 재귀가 생긴다. 소유자 권한으로 읽어 끊는다.
-- 왜 plpgsql인가: SQL 함수는 만들 때 본문의 테이블·컬럼을 검사하지만, plpgsql은 실행할 때 검사한다.
--   profiles.role·partners는 다음 마이그레이션(0009)에서 생기므로 plpgsql이어야 먼저 만들 수 있다.

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'admin'
  );
end;
$$;
--> statement-breakpoint

-- 활동 중인 파트너의 id. 파트너가 아니거나 이용 정지면 null → 파트너 정책을 하나도 통과하지 못한다
create or replace function public.my_partner_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select pa.id into v_id
  from public.partners pa
  where pa.owner_user_id = auth.uid() and pa.status::text = 'active';
  return v_id;
end;
$$;
--> statement-breakpoint

revoke execute on function public.is_admin() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.my_partner_id() from public, anon, authenticated;
--> statement-breakpoint
-- 이 함수를 부르는 정책은 모두 authenticated 대상이라 anon에게는 주지 않는다
grant execute on function public.is_admin() to authenticated;
--> statement-breakpoint
grant execute on function public.my_partner_id() to authenticated;
