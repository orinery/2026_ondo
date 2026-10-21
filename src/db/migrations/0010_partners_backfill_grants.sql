-- Custom SQL migration file, put your code below! --
-- 파트너·관리자 3/3: 0009(Drizzle 자동 생성)에서 표현할 수 없는 것들
--   1) 기존 상품 이전: "여운 직영" 파트너에 배정, 공개 상태로
--   2) 권한(GRANT): profiles.role 숨기기, 파트너 신청·상품 쓰기 컬럼
--   3) 파트너 신청 검증 트리거, 관리자 함수(승인·거절·정지), 내 계정 정보 함수
--
-- 오류는 `raise exception '<코드>'`로 던지고 앱이 src/lib/order-errors.ts에서 한국어로 바꾼다 (0005와 같은 방식).

-- ─── 1) 기존 상품 이전 ──────────────────────────────────────────────────
-- 로그인 계정이 없는 직영 파트너. 고정 id라 시드·문서에서 같은 값을 쓴다
insert into public.partners (id, name, contact_name, contact_phone, contact_email, intro)
values (
  '00000000-0000-4000-8000-000000000001',
  '여운 직영',
  '여운 운영팀',
  '02-1234-5678',
  'partners@yeoun.example',
  '여운이 직접 기획하고 운영하는 일본 여행 상품입니다.'
)
on conflict (id) do nothing;
--> statement-breakpoint
update public.products
set partner_id = '00000000-0000-4000-8000-000000000001'
where partner_id is null;
--> statement-breakpoint
-- 지금까지 판매하던 상품은 모두 공개 상태로 둔다 (published_at이 없으면 임시 저장으로 숨겨진다)
update public.products set published_at = created_at where published_at is null;
--> statement-breakpoint
alter table public.products alter column partner_id set not null;
--> statement-breakpoint

-- ─── 2) 권한 ───────────────────────────────────────────────────────────
-- 프로필은 리뷰 작성자 표시 때문에 공개지만, 역할(role)은 공개하지 않는다 (관리자 계정을 드러내지 않기 위해).
-- 테이블 단위 SELECT가 있으면 컬럼을 골라 막을 수 없으므로, 회수한 뒤 컬럼 단위로 다시 준다.
-- 본인 역할은 my_profile() 함수로 읽는다.
revoke select on public.profiles from anon, authenticated;
--> statement-breakpoint
grant select (id, display_name, avatar_url, terms_agreed_at, created_at, updated_at)
  on public.profiles to anon, authenticated;
--> statement-breakpoint

-- Supabase가 새 테이블에 기본으로 주는 권한을 회수한 뒤 필요한 것만 준다 (0001·0005와 같은 방식)
revoke all on public.partners, public.partner_applications from anon, authenticated;
--> statement-breakpoint
-- 어떤 행을 볼 수 있는지는 RLS(본인·관리자)가 정한다
grant select on public.partners, public.partner_applications to authenticated;
--> statement-breakpoint
-- 신청서는 내용만 쓸 수 있다. 상태·거절 사유·검토자는 관리자 함수만 바꾼다
grant insert (business_name, contact_name, contact_phone, contact_email, intro)
  on public.partner_applications to authenticated;
--> statement-breakpoint

-- 상품: 파트너가 쓸 수 있는 "내용" 컬럼만 준다. 어떤 상품인지는 RLS(본인 파트너)가 정한다.
-- partner_id(기본값으로 채워짐), 평점 캐시, 추천 순위, 관리자 판매 중지 컬럼은 주지 않는다.
grant insert (slug, city_id, category, theme, title, summary, description, highlights,
  image_url, image_alt, adult_price, child_price, list_adult_price, operating_days, cutoff_days,
  max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point, latitude,
  longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at)
  on public.products to authenticated;
--> statement-breakpoint
-- slug는 만들 때만 정한다 (바꾸면 공유된 상품 주소가 깨진다)
grant update (city_id, category, theme, title, summary, description, highlights,
  image_url, image_alt, adult_price, child_price, list_adult_price, operating_days, cutoff_days,
  max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point, latitude,
  longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at)
  on public.products to authenticated;
--> statement-breakpoint

-- ─── 3) 파트너 신청 검증 ─────────────────────────────────────────────────
-- 정책(본인 행)만으로는 "이미 파트너인지"를 알 수 없어서 트리거로 막는다.
-- security definer: 사용자는 profiles.role을 읽을 권한이 없으므로 소유자 권한으로 확인한다.
create or replace function public.check_partner_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p where p.id = new.user_id and p.role::text <> 'customer'
  ) or exists (
    select 1 from public.partners pa where pa.owner_user_id = new.user_id
  ) then
    raise exception 'already_partner';
  end if;
  -- 부분 unique 인덱스도 막지만, 알아볼 수 있는 오류 코드를 주기 위해 먼저 확인한다
  if exists (
    select 1 from public.partner_applications a
    where a.user_id = new.user_id and a.status::text = 'pending'
  ) then
    raise exception 'application_pending';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger partner_applications_check before insert on public.partner_applications
  for each row execute function public.check_partner_application();
--> statement-breakpoint

-- ─── 4) 관리자 함수 ─────────────────────────────────────────────────────
-- 승인: 신청서로 파트너를 만들고 신청자 역할을 partner로 바꾼다 (한 트랜잭션)
create or replace function public.approve_partner_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.partner_applications%rowtype;
  v_partner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- 관리자 두 명이 동시에 처리해도 한 번만 승인되도록 신청서 행을 잠근다
  select * into v_app
  from public.partner_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_app.status::text <> 'pending' then
    raise exception 'not_pending';
  end if;
  -- 신청 뒤에 관리자로 지정되는 등 역할이 바뀌었을 수 있다 (1계정 1역할)
  if exists (
    select 1 from public.profiles p where p.id = v_app.user_id and p.role::text <> 'customer'
  ) then
    raise exception 'already_partner';
  end if;

  insert into public.partners (owner_user_id, name, contact_name, contact_phone, contact_email, intro)
  values (v_app.user_id, v_app.business_name, v_app.contact_name, v_app.contact_phone,
    v_app.contact_email, v_app.intro)
  returning id into v_partner_id;

  update public.profiles set role = 'partner' where id = v_app.user_id;

  update public.partner_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id;

  return v_partner_id;
end;
$$;
--> statement-breakpoint

create or replace function public.reject_partner_application(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if char_length(v_reason) not between 1 and 200 then
    raise exception 'invalid_reason';
  end if;

  select a.status::text into v_status
  from public.partner_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.partner_applications
  set status = 'rejected', reject_reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id;
end;
$$;
--> statement-breakpoint

-- 이용 정지: my_partner_id()가 null을 돌려주게 되어 파트너 센터·상품 수정이 모두 막힌다 (공개 상품은 그대로)
create or replace function public.admin_set_partner_status(p_partner_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status';
  end if;

  update public.partners set status = p_status::public.partner_status where id = p_partner_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
--> statement-breakpoint

-- 내 계정 정보 (화면 상단·역할 확인용). role은 컬럼 권한이 없으므로 이 함수로만 읽는다.
-- 파트너는 이용 정지 상태여도 돌려준다 → 콘솔에서 "이용 정지" 안내를 보여줄 수 있게
create or replace function public.my_profile()
returns table (
  display_name text,
  avatar_url text,
  role text,
  partner_id uuid,
  partner_name text,
  partner_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.avatar_url, p.role::text, pa.id, pa.name, pa.status::text
  from public.profiles p
  left join public.partners pa on pa.owner_user_id = p.id
  where p.id = auth.uid();
$$;
--> statement-breakpoint

-- ─── 5) 함수 실행 권한 ──────────────────────────────────────────────────
revoke execute on function public.check_partner_application() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.approve_partner_application(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.reject_partner_application(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_set_partner_status(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.my_profile() from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 실행 권한을 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.approve_partner_application(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.reject_partner_application(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_partner_status(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.my_profile() to authenticated;
