-- Custom SQL migration file, put your code below! --
-- 판매자 신원 정보 2/2: 0038(컬럼)에 이어 (Quick Win Q3)
--   1) 신청서에 새 항목을 쓸 수 있게 컬럼 권한
--   2) 승인 함수가 새 항목도 파트너로 복사 (본문은 0010과 같고 insert 컬럼만 더했다, 인자 그대로)
--   3) 공개 판매자 정보 조회 product_sellers — partners는 본인·관리자만 읽을 수 있어서(RLS)
--      상품 페이지·주문서에 필요한 공개 항목만 돌려주는 definer 함수를 둔다

-- ─── 1) 권한 ───────────────────────────────────────────────────────────
grant insert (representative, business_reg_no, business_address, tourism_license_no)
  on public.partner_applications to authenticated;
--> statement-breakpoint

-- ─── 2) 승인 ───────────────────────────────────────────────────────────
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

  insert into public.partners (
    owner_user_id, name, contact_name, contact_phone, contact_email, intro,
    representative, business_reg_no, business_address, tourism_license_no
  )
  values (v_app.user_id, v_app.business_name, v_app.contact_name, v_app.contact_phone,
    v_app.contact_email, v_app.intro,
    v_app.representative, v_app.business_reg_no, v_app.business_address, v_app.tourism_license_no)
  returning id into v_partner_id;

  update public.profiles set role = 'partner' where id = v_app.user_id;

  update public.partner_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id;

  return v_partner_id;
end;
$$;
--> statement-breakpoint

-- ─── 3) 공개 판매자 정보 ─────────────────────────────────────────────────
-- 공개된 상품의 판매 파트너 — 상호·대표자·사업자등록번호·주소·연락처·이메일·여행업 등록번호.
-- 담당자 이름·수수료율·상태 등은 돌려주지 않는다. 한 번에 상품 50개까지 (주문서 장바구니 상한보다 넉넉히).
create or replace function public.product_sellers(p_product_ids uuid[])
returns table (
  product_id uuid,
  name text,
  representative text,
  business_reg_no text,
  business_address text,
  phone text,
  email text,
  tourism_license_no text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, pa.name, pa.representative, pa.business_reg_no, pa.business_address,
         pa.contact_phone, pa.contact_email, pa.tourism_license_no
  from public.products p
  join public.partners pa on pa.id = p.partner_id
  where p.id = any(p_product_ids)
    and p.published_at is not null
    and cardinality(p_product_ids) <= 50;
$$;
--> statement-breakpoint
revoke execute on function public.product_sellers(uuid[]) from public;
--> statement-breakpoint
grant execute on function public.product_sellers(uuid[]) to anon, authenticated;
