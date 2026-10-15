-- Custom SQL migration file, put your code below! --
-- 일정 플래너: 같은 날(Day) 안의 항목 순서를 한 번에 저장한다.
--
-- 왜 함수로 만드나
-- - 항목 N개의 position을 바꾸려면 UPDATE가 N번 필요하다. 클라이언트에서 N번 요청하면
--   중간에 실패했을 때 순서가 반쯤 바뀐 채로 남을 수 있다. 함수 하나 = 트랜잭션 하나라서 전부 바뀌거나 전부 그대로다.
-- - security invoker: 호출한 사용자 권한으로 실행되므로 trip_items의 RLS(본인 여행만)가 그대로 적용된다.
--   남의 여행 id를 넘기면 바뀌는 행이 0개일 뿐이다.
create or replace function public.reorder_trip_items(p_trip_id uuid, p_day_index smallint, p_item_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.trip_items as t
  set position = o.ord - 1
  from unnest(p_item_ids) with ordinality as o(id, ord)
  where t.id = o.id
    and t.trip_id = p_trip_id
    and t.day_index = p_day_index;
$$;
--> statement-breakpoint
revoke execute on function public.reorder_trip_items(uuid, smallint, uuid[]) from public, anon;
--> statement-breakpoint
grant execute on function public.reorder_trip_items(uuid, smallint, uuid[]) to authenticated;
