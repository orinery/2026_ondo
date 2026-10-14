-- Custom SQL migration file, put your code below! --
-- 0000_init(Drizzle 자동 생성)에서 표현할 수 없는 것들:
--   1) updated_at 자동 갱신 트리거
--   2) 회원가입 시 profiles 자동 생성 트리거
--   3) 리뷰 변경 시 여행지 평점·리뷰 수 캐시 갱신 트리거
--   4) 테이블·컬럼 단위 권한(GRANT) — RLS와 함께 이중 방어
--   5) 리뷰 사진 Storage 버킷과 정책

-- ─── 1) updated_at ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
--> statement-breakpoint
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger trips_set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- ─── 2) 회원가입 → profiles 생성 ─────────────────────────────────────────
-- security definer: 가입 직후의 사용자는 profiles INSERT 권한이 없으므로 함수 소유자 권한으로 넣는다.
-- search_path = '': 악의적인 스키마의 같은 이름 객체가 끼어드는 것을 막는 Supabase 권장 설정.
-- 이름은 이메일 가입의 "name" 메타데이터 → 소셜 로그인의 "full_name" → 이메일 앞부분 순으로 쓴다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, terms_agreed_at)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      '여행자'
    ), 30),
    new.raw_user_meta_data ->> 'avatar_url',
    case when (new.raw_user_meta_data ->> 'terms_agreed') = 'true' then now() end
  );
  return new;
end;
$$;
--> statement-breakpoint
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
--> statement-breakpoint

-- ─── 3) 리뷰 → 여행지 평점 캐시 ─────────────────────────────────────────
-- 사용자는 destinations를 수정할 권한이 없으므로 security definer로 갱신한다.
create or replace function public.refresh_destination_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.destination_id, old.destination_id);
begin
  update public.destinations d
  set rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.destination_id = target), 0),
      review_count = (select count(*) from public.reviews r where r.destination_id = target)
  where d.id = target;
  return null; -- AFTER 트리거라 반환값은 쓰이지 않는다
end;
$$;
--> statement-breakpoint
create trigger reviews_refresh_rating after insert or update of rating or delete on public.reviews
  for each row execute function public.refresh_destination_rating();
--> statement-breakpoint

-- 트리거 전용 함수는 API(RPC)로 직접 호출되지 않게 실행 권한을 회수한다
revoke execute on function public.set_updated_at() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.handle_new_user() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.refresh_destination_rating() from public, anon, authenticated;
--> statement-breakpoint

-- ─── 4) 권한(GRANT) ─────────────────────────────────────────────────────
-- RLS는 "어떤 행"을, GRANT는 "어떤 테이블·컬럼·동작"을 허용한다. 둘 다 통과해야 쿼리가 성공한다.
-- 기본 권한에 기대지 않고 필요한 것만 명시적으로 준다.
revoke all on all tables in schema public from anon, authenticated;
--> statement-breakpoint

-- 공개 읽기
grant select on public.destinations, public.destination_images, public.destination_itinerary_items,
  public.profiles, public.reviews to anon, authenticated;
--> statement-breakpoint

-- 프로필: 표시 정보만 수정 가능 (id·생성일은 수정 불가)
grant update (display_name, avatar_url, terms_agreed_at) on public.profiles to authenticated;
--> statement-breakpoint

-- 리뷰: 작성·삭제 + 내용만 수정 가능 (작성자·여행지는 바꿀 수 없음)
grant insert (destination_id, rating, content, photo_path) on public.reviews to authenticated;
--> statement-breakpoint
grant update (rating, content, photo_path) on public.reviews to authenticated;
--> statement-breakpoint
grant delete on public.reviews to authenticated;
--> statement-breakpoint

-- 찜 폴더·찜
grant select, delete on public.like_folders, public.likes to authenticated;
--> statement-breakpoint
grant insert (name) on public.like_folders to authenticated;
--> statement-breakpoint
grant update (name) on public.like_folders to authenticated;
--> statement-breakpoint
grant insert (destination_id, folder_id) on public.likes to authenticated;
--> statement-breakpoint
grant update (folder_id) on public.likes to authenticated;
--> statement-breakpoint

-- 여행·일정 항목
grant select, delete on public.trips, public.trip_items to authenticated;
--> statement-breakpoint
grant insert (title, start_date, end_date) on public.trips to authenticated;
--> statement-breakpoint
grant update (title, start_date, end_date) on public.trips to authenticated;
--> statement-breakpoint
grant insert (trip_id, day_index, position, title, time, type, note, caution, destination_id)
  on public.trip_items to authenticated;
--> statement-breakpoint
grant update (day_index, position, title, time, type, note, caution, destination_id)
  on public.trip_items to authenticated;
--> statement-breakpoint

-- ─── 5) Storage: 리뷰 사진 ───────────────────────────────────────────────
-- 공개 버킷(누구나 URL로 볼 수 있음), 5MB 이하 JPEG/PNG/WebP만 허용
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint

-- 업로드·교체·삭제는 본인 폴더("{user_id}/...")에서만
create policy "review_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
create policy "review_photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
--> statement-breakpoint
create policy "review_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
