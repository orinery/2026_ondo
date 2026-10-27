# 데이터베이스 설계 (ERD)

- 스키마 정의: [`src/db/schema.ts`](../src/db/schema.ts) (Drizzle, RLS 정책 포함)
- 마이그레이션: [`src/db/migrations`](../src/db/migrations)
  - `0000`~`0002` — 여행지 소개 사이트 시절의 기본 구조 (프로필·찜·여행·리뷰·Storage)
  - `0003`~`0007` — 쇼핑몰 전환: 여행지 삭제, 도시·상품·취소 규정·장바구니·주문, 예약 규칙·주문·취소·환불 함수, 플래너 연결
  - `0008`~`0010` — 역할·파트너: `is_admin()`·`my_partner_id()`(정책보다 먼저), 파트너·파트너 신청, 기존 상품을 "여운 직영"으로 이전, 관리자 승인 함수
  - `0011`~`0012` — 회차 재고·옵션·항목 상태: 기존 주문·장바구니 이전, 좌석 확보(`place_order` v3), 항목 단위 취소, `release_item`
  - `0013`~`0015` — 파트너 센터: 상품 사진 Storage, `save_product`, 재고 일괄 수정, 예약 확정·거절·바우처, 자동 만료 + pg_cron
  - `0016`~`0017` — 정산: `settlements` 스냅숏, 정산 계산 함수, 관리자 정산 완료
  - `0018`~`0019` — 관리자 콘솔: 리뷰 신고·숨김, 상품 판매 중지, 대시보드 통계
  - `0020`~`0022` — 감사 로그: `audit_logs`, 상태 변경 트리거(주문·항목·상품 중지·파트너 정지·정산·리뷰 숨김), 기존 주문 이력 백필, 행위자를 "동작 자격"으로(파트너 계정의 구매·취소 = 고객)
  - `0023`~`0024` — 관리자 주문 처리: CS 메모, 운영자 취소(귀책 코드별 환불), 환불 조정(늘리기만), 정산 조정 전표, `release_item`·정산 함수 교체
  - `0025` — 관리자 주문 목록 `admin_orders`: 검색·상태(부분 취소 포함)·파트너·결제일 필터 + 페이지 (화면·CSV 공용)
  - `0026`~`0027` — 판매 중지 종류(`suspended_kind`: 정보 수정 필요 · 운영 불가·위험 · 파트너 이용 정지), 파트너 정지 시 상품 일괄 중지·해제, 관리자 조치 사유 필수, 영향 미리보기
  - `0028`~`0029` — 취소 규정 스냅숏: `order_items.cancel_tiers`(주문할 때 트리거가 구간 복사, 기존 주문 백필), `refund_quote`가 저장된 구간으로 계산
  - `0030` — 회원을 지워도 주문은 남긴다: `orders.user_id` → `ON DELETE SET NULL`
  - `0031` — 파트너 예약자 연락처 가리기: `partner_bookings`가 살아 있는 예약 + 이용일 7일 뒤까지만 원문, 그 밖은 가린 값(`mask_name`·`mask_phone`·`mask_email`), 조회는 90일 전 이용분부터
- 시드: [`src/db/seed.ts`](../src/db/seed.ts), [`src/db/seed-data.ts`](../src/db/seed-data.ts)
- 검증: [`src/db/verify-rls.ts`](../src/db/verify-rls.ts) (역할별 283개 시나리오, 롤백) · [`src/db/verify-race.ts`](../src/db/verify-race.ts) (동시 결제)

## ERD

```mermaid
erDiagram
  auth_users ||--|| profiles : "가입 시 트리거로 생성"
  profiles |o--o| partners : "소유자 (1계정 1역할)"
  profiles ||--o{ partner_applications : "신청 → 관리자 승인"
  partners ||--o{ products : "판매"
  cities ||--o{ products : ""
  cancellation_policies ||--o{ cancellation_policy_tiers : "환불 구간"
  cancellation_policies ||--o{ products : ""
  products ||--o{ product_images : has
  products ||--o{ product_itinerary_items : "진행 일정"
  products ||--|{ product_slots : "회차"
  product_slots ||--o{ slot_inventory : "날짜별 재고"
  products ||--o{ product_options : "추가 옵션"
  profiles ||--o{ cart_items : owns
  product_slots ||--o{ cart_items : ""
  profiles |o--o{ orders : "owns (회원 삭제 시 null, 주문은 보존)"
  orders ||--|{ order_items : contains
  product_slots ||--o{ order_items : "구매 회차"
  partners ||--o{ order_items : "정산 대상 (스냅숏)"
  order_items ||--o{ order_item_options : "구매 시점 옵션"
  partners ||--o{ settlements : "월 정산 완료"
  profiles ||--o{ likes : owns
  profiles ||--o{ reviews : writes
  products ||--o{ reviews : "구매 고객만"
  reviews ||--o{ review_reports : "신고"
  profiles |o--o{ audit_logs : "행위자 (null = 시스템)"
  orders ||--o{ order_memos : "CS 메모 (관리자)"
  order_items ||--o{ refund_adjustments : "환불 조정"
  order_items ||--o{ settlement_adjustments : "정산 완료 뒤 조정 전표"
  partners ||--o{ settlement_adjustments : ""
  profiles ||--o{ trips : owns
  trips ||--o{ trip_items : contains
  order_items |o--o| trip_items : "예약 항목"

  profiles {
    uuid id PK
    text display_name
    enum role "customer·partner·admin (공개 읽기 불가)"
  }
  partners {
    uuid id PK
    uuid owner_user_id FK,UK "null = 직영·데모"
    enum status "active·suspended"
    numeric commission_rate "기본 15%"
  }
  products {
    uuid id PK
    text slug UK
    uuid partner_id FK "기본값 my_partner_id()"
    int adult_price "원"
    int child_price "null = 성인 전용"
    smallint_array operating_days "ISO 요일"
    smallint cutoff_days "N일 전 마감"
    enum confirmation_mode "instant·manual"
    timestamptz published_at "null = 임시 저장"
    text suspended_reason "관리자 판매 중지"
    enum suspended_kind "info_fix·unsafe·partner_suspended"
  }
  product_slots {
    uuid id PK
    uuid product_id FK
    time start_time "null = 종일권"
    smallint capacity "기본 정원"
    bool active "지우지 않고 판매만 끔"
  }
  slot_inventory {
    uuid slot_id PK,FK
    date use_date PK
    smallint capacity "덮어쓴 정원"
    bool closed
    int adult_price "덮어쓴 가격"
    smallint booked "예약 인원 (함수만 변경)"
  }
  cart_items {
    uuid id PK
    uuid user_id FK "기본값 auth.uid()"
    uuid slot_id FK
    date use_date
    uuid_array option_ids
  }
  orders {
    uuid id PK
    text order_no UK
    enum status "paid·cancelled"
    int total_amount "DB가 계산"
    int refund_amount "항목 환불 합계"
    uuid idempotency_key "사용자별 unique"
  }
  order_items {
    uuid id PK
    uuid order_id FK
    enum status "pending·confirmed·used·rejected·cancelled·expired"
    uuid slot_id FK
    time start_time "구매 시점"
    int subtotal "인원 + 옵션"
    uuid partner_id FK "스냅숏"
    numeric commission_rate "스냅숏"
    text voucher_code UK "확정 시 발급"
    timestamptz confirm_deadline "확정 대기 기한"
    jsonb cancel_tiers "주문 시점 환불 구간"
  }
  settlements {
    uuid partner_id PK,FK
    date month PK "이용월 1일"
    int revenue
    int commission
    int payout "revenue - commission"
  }
  reviews {
    uuid id PK
    uuid user_id FK
    uuid product_id FK
    smallint rating "1~5"
    timestamptz hidden_at "신고로 숨김"
  }
  review_reports {
    uuid id PK
    uuid review_id FK
    uuid reporter_id FK "기본값 auth.uid()"
    enum reason
    enum status "pending·dismissed·actioned"
  }
  audit_logs {
    uuid id PK
    uuid actor_id FK "null = 시스템"
    text actor_role "customer·partner·admin·system"
    text entity "order·order_item·product·partner·settlement·review"
    uuid entity_id "외래 키 없음 (원본이 지워져도 남김)"
    uuid order_id "주문 타임라인용"
    text action "예: item.cancelled"
    jsonb before_after "이전 값 → 변경 값"
  }
  settlement_adjustments {
    uuid id PK
    uuid partner_id FK
    date month "반영할 달 (조정한 달)"
    uuid order_item_id FK
    int revenue_delta "환불 증액이면 음수"
    int commission_delta
  }
```

`cities`·`product_images`·`product_itinerary_items`·`product_options`·`order_item_options`·`order_memos`·`refund_adjustments`·`partner_applications`·`like_folders`·`likes`·`trips`·`trip_items`는 그림을 간단히 하려고 컬럼을 생략했다 (스키마 파일 참고).

## 예약 흐름과 DB 함수

```mermaid
sequenceDiagram
  participant U as 고객
  participant P as 파트너
  participant DB as Postgres
  U->>DB: 장바구니 담기 (상품·회차·이용일·인원·옵션)
  DB-->>DB: 트리거 → booking_error (요일·마감·인원·회차·옵션·남은 자리)
  U->>DB: rpc place_order (장바구니 id · 예약자 · 화면 총액 · 중복 방지 키)
  DB-->>DB: 같은 키 → 기존 주문 / 장바구니 잠금 / 규칙 재검사 / line_price로 금액 → 다르면 price_changed
  DB-->>DB: 회차·날짜 순으로 좌석 확보 (남은 자리 없으면 sold_out → 전체 롤백)
  DB-->>DB: 즉시 확정 → confirmed + 바우처 / 파트너 확정 → pending + 기한
  P->>DB: rpc confirm_item / reject_item
  DB-->>DB: 확정 → 바우처 발급 / 거절 → release_item(전액 환불·좌석 반환·플래너 정리)
  DB-->>DB: pg_cron 10분 → expire_pending_items (기한 지나면 release_item, 전액 환불)
  U->>DB: rpc cancel_order_item (확정 대기 100%, 확정은 규정 구간)
  P->>DB: rpc mark_used (이용일 당일부터, 바우처 코드)
```

| 함수                                                                                                            | 실행 권한                 | 하는 일                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `is_admin()` · `my_partner_id()` · `my_profile()`                                                               | definer                   | 역할 판단 (정책·함수에서 사용), 본인 계정 정보                                                                          |
| `booking_error(상품, 날짜, 회차, 성인, 아동, 옵션)`                                                             | invoker                   | 예약할 수 없으면 이유 코드(`cutoff`·`slot_closed`·`sold_out`…), 가능하면 null                                           |
| `line_price(…)`                                                                                                 | invoker                   | 날짜별 덮어쓴 가격 + 옵션 금액 — 장바구니 화면과 결제가 같은 공식                                                       |
| `place_order(…)`                                                                                                | definer                   | 금액 재계산·중복 결제 방지·장바구니 잠금·**좌석 확보**·플래너 연결을 한 트랜잭션으로                                    |
| `release_item(항목, 상태, 환불액, 사유)`                                                                        | 내부 전용                 | 취소·거절·만료 공통: 좌석 반환·예약 일정 삭제·주문 환불 합계(모든 항목 환불액 합)·전체 취소 판정, 거절·운영자 취소 사유 |
| `cancel_order_item` · `cancel_order` · `refund_quote`                                                           | definer / definer / inv.  | 항목·주문 취소, 환불 예정액(확인 창과 실제 취소가 같은 계산)                                                            |
| `approve_/reject_partner_application` · `admin_set_partner_status(파트너, 상태, 사유)` · `admin_partner_impact` | definer + `is_admin()`    | 파트너 신청 처리, 이용 정지(그 파트너 상품 일괄 중지 → 해제 시 그것만 재개)                                             |
| `save_product(…)`                                                                                               | invoker (RLS·GRANT 적용)  | 상품·사진·진행 일정·회차·옵션을 한 트랜잭션으로 저장                                                                    |
| `set_inventory_range(…)`                                                                                        | invoker                   | 기간 × 요일 정원·마감·가격 덮어쓰기 (예약보다 적은 정원은 트리거가 거부)                                                |
| `partner_bookings` · `confirm_item` · `reject_item` · `mark_used`                                               | definer + `my_partner_id` | 파트너 예약 목록(연락처는 이용일 7일 뒤·취소 시 가림, 운영자 취소 사유), 확정·거절, 바우처 사용 처리                    |
| `expire_pending_items()`                                                                                        | definer                   | 기한 지난 확정 대기 자동 취소 (pg_cron 10분 + 화면을 열 때)                                                             |
| `settlement_items` · `settlement_summary`                                                                       | definer + 범위 확인       | 정산 대상 항목·월 합계 (파트너는 자기 것만, 관리자는 전체)                                                              |
| `admin_settle_month`                                                                                            | definer + `is_admin()`    | 끝난 달 정산 완료 → `settlements`에 숫자 고정                                                                           |
| `resolve_review_report` · `admin_set_review_hidden`                                                             | definer + `is_admin()`    | 신고 기각·숨김, 숨김 해제 (처리 사유 필수 → 감사 로그)                                                                  |
| `admin_set_product_suspension(상품, 중지?, 종류, 사유)` · `admin_product_impact`                                | definer + `is_admin()`    | 판매 중지·재개(사유 필수) — 운영 불가면 이용 전 예약 전액 환불 취소, 영향 미리보기                                      |
| `admin_cancel_item` · `admin_adjust_refund`                                                                     | definer + `is_admin()`    | 운영자 취소(귀책 코드별 환불), 환불 조정(늘리기만 · 정산 완료 달이면 조정 전표)                                         |
| `admin_orders(검색, 상태, 파트너, 기간, limit, offset)`                                                         | definer + `is_admin()`    | 주문 목록 — 화면과 같은 상태 규칙, 항목 상태별 수, 판매 파트너, 전체 건수 (최대 5,000)                                  |
| `admin_kpis` · `admin_daily_stats` · `admin_breakdown`                                                          | definer + `is_admin()`    | 대시보드 지표·일별 결제·도시/종류별 매출                                                                                |
| `write_audit(…)` + `audit_*` 트리거                                                                             | 내부 전용                 | 상태가 바뀔 때 행위자(`auth.uid()`의 역할, 없으면 system)·사유·이전/변경 값을 기록                                      |
| `has_used_product` · `attach_bookings` · `reorder_trip_items`                                                   | invoker / definer / inv.  | 리뷰 자격(항목 상태 기준), 플래너 예약 붙이기, 일정 순서 저장                                                           |

security definer 함수는 모두 `search_path = ''`와 스키마를 붙인 이름만 쓴다. 고객 함수는 `auth.uid()`, 파트너 함수는 `my_partner_id()`, 관리자 함수는 `is_admin()`으로 첫 줄에서 확인하고, 남의 데이터 id에는 "없음(`not_found`)"과 같은 오류를 돌려줘 존재 여부를 알 수 없게 한다.

## 설계 결정

| 결정                                                                                    | 이유                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 주문·주문 항목은 **읽기 권한만**, 생성·취소·확정은 DB 함수로만                          | 클라이언트가 금액·상태를 넣을 수 있으면 위조할 수 있다. 가격은 `line_price`로 다시 계산하고 화면 금액은 "확인용"으로만 받는다                                                                                                                                                                  |
| 역할 판단은 RLS + definer 함수                                                          | 로그인 사용자는 모두 DB 역할 `authenticated` — 컬럼 GRANT로는 파트너·관리자를 나눌 수 없다. 관리자 전용 컬럼은 GRANT 없이 함수로만 바꾼다                                                                                                                                                      |
| 좌석은 "조건부 UPDATE 한 문장"으로 확보                                                 | `booked + 인원 <= 정원`일 때만 늘린다. 동시 결제는 행 잠금 뒤 바뀐 값으로 다시 평가돼 초과 판매가 없다. 잠금 순서(회차·날짜)를 고정해 교착 방지                                                                                                                                                |
| 불변식: `booked` = 살아 있는 항목 인원 합                                               | 늘리는 곳은 `place_order`, 줄이는 곳은 `release_item` 하나. 기존 데이터 이전·시드도 같은 규칙으로 맞췄다                                                                                                                                                                                       |
| 회차·옵션은 지우지 않고 판매만 끈다                                                     | 장바구니·주문 항목이 참조한다. 시드·`save_product` 모두 upsert + `active = false`                                                                                                                                                                                                              |
| 주문 항목에 **구매 시점** 상품명·단가·회차 시간·옵션·파트너·수수료율·**환불 구간** 복사 | 나중에 상품·수수료율이 바뀌어도 예약 내역과 정산은 산 그대로여야 한다                                                                                                                                                                                                                          |
| 파트너에게 `orders` 읽기 정책 없음, 연락처는 **기간 한정 원문**                         | 한 주문에 다른 파트너 상품이 섞이면 총액·중복 방지 키 등이 보인다. 예약자 연락처는 `partner_bookings`로 필요한 열만, 그것도 현장 연락·사후 문의에 필요한 기간(살아 있는 예약 + 이용일 7일 뒤)만 원문이고 그 뒤·취소 예약은 가린 값 (A-06)                                                      |
| 자동 만료 = pg_cron + 화면을 열 때                                                      | 무료 프로젝트가 일시 정지되면 cron이 멈춘다. 멱등 함수라 화면을 열 때 한 번 더 불러도 안전하다                                                                                                                                                                                                 |
| 정산 완료 = 스냅숏, 이후 변동은 **조정 전표**                                           | 관리자가 처리한 뒤 데이터가 바뀌어도 그 달 숫자는 그대로. 처리 전 달은 실시간 계산. 정산 완료 뒤 환불을 늘리면 차액(매출·수수료)을 조정한 달에 `settlement_adjustments`로 넣고, 원래 달 항목은 조정 전 값으로 보여 스냅숏과 맞춘다 (사용자 확정)                                               |
| 운영자 취소 환불은 **귀책 코드**가 정한다                                               | 사람마다 금액이 달라지지 않게 사유를 고르면 환불이 정해진다: 파트너 사정·기상·최소 인원 미달 = 전액, 고객 요청 대행 = 취소 규정(고객 본인 취소와 같은 `refund_quote`). 규정 밖 금액은 별도의 환불 조정(사유 필수, 늘리기만)으로                                                                |
| 판매 중지를 **종류**로 나눈다                                                           | 같은 "판매 중지"라도 정보 오류와 안전 문제는 기존 예약 처리가 다르다: 정보 수정 필요 = 신규 판매만, 운영 불가·위험 = 이용 전 예약도 전액 환불 취소. 파트너 정지로 중지된 상품은 종류로 구분해 해제할 때 그것만 다시 연다. 판매 중지 상품은 공개 목록에서 빼고 상세는 기존 예약자를 위해 남긴다 |
| 숨긴 리뷰: 제한 정책을 anon·로그인으로 나눔                                             | anon에게는 `is_admin()` 실행 권한이 없다. 정책 대상 역할을 나눠 anon 정책에서는 함수를 부르지 않는다                                                                                                                                                                                           |
| 예약 규칙은 DB 함수 하나(`booking_error`)                                               | 장바구니 트리거와 주문 함수가 같은 규칙. 화면용 복사본(`src/lib/booking.ts`)은 달력 비활성화 등 UX용이고 최종 판단은 항상 DB                                                                                                                                                                   |
| 날짜는 `seoul_today()` 기준                                                             | DB 서버 시간대(UTC)와 관계없이 한국(=일본) 날짜로 마감·환불·정산 월을 계산한다                                                                                                                                                                                                                 |
| 감사 로그는 **트리거**로 남긴다                                                         | 함수마다 기록 코드를 넣으면 빠뜨리기 쉽다. 상태 열이 바뀌면 경로와 관계없이 남고, 사유는 관리자 함수가 트랜잭션 로컬 설정(`ondo.audit_reason`)으로 넘긴다. 기한 초과 만료는 화면을 연 사람과 무관하게 system                                                                                   |
| 앱의 데이터 접근은 supabase-js, Drizzle은 스키마·마이그레이션·시드 전용                 | Drizzle은 postgres 권한으로 접속해 RLS를 우회한다. 사용자 요청은 항상 사용자 JWT로 실행돼야 RLS가 마지막 방어선이 된다                                                                                                                                                                         |

## 데이터 보존 · 회원 삭제

회원 계정(`auth.users`)을 지우면 프로필과 개인 데이터(장바구니·찜·여행·리뷰·신고·파트너 신청)는 연쇄 삭제되지만, **주문은 남는다**(`orders.user_id`만 null, A-05).

| 남기는 것                                          | 이유                          | 보존 기간 (전자상거래법 시행령 제6조 기준, 예시) |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| 주문 · 주문 항목 · 옵션 · 환불 금액                | 계약·청약철회, 대금 결제 기록 | 5년                                              |
| 운영자 취소 사유 · 환불 조정 · CS 메모 · 감사 로그 | 소비자 불만·분쟁 처리 기록    | 3년 (주문과 함께 보관)                           |
| 정산 스냅숏 · 조정 전표                            | 파트너 지급 근거              | 5년                                              |

- 소유자가 없는 주문은 RLS상 관리자만 본다(고객 정책은 `user_id = auth.uid()`라 null과 같아지지 않는다).
- 주문의 예약자 이름·연락처·이메일(`booker_*`)은 보존 기간이 지나면 파기(익명화)해야 한다 — 탈퇴 화면과 파기 배치는 아직 없다 (포트폴리오 범위 밖).
- 회원이 쓴 리뷰는 함께 지워져 상품 평점이 다시 계산된다(트리거).

## 권한 요약 (역할 × 테이블)

| 대상                                                       | anon             | 고객                                     | 파트너                             | 관리자                                      |
| ---------------------------------------------------------- | ---------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------------- |
| 공개 상품 · 사진 · 일정 · 회차 · 옵션 · 재고 · 도시 · 규정 | 읽기             | 읽기                                     | 읽기 + 본인 상품 쓰기(내용 컬럼만) | 전체 읽기(임시 저장 포함), 판매 중지는 함수 |
| profiles                                                   | 표시 정보만      | 표시 정보 읽기, 본인 수정 (역할 불가)    | 같음                               | 같음 (역할 변경은 승인 함수)                |
| cart_items                                                 | —                | 본인 것만 (가격 컬럼 없음)               | 같음                               | 같음                                        |
| orders                                                     | —                | 본인 것 읽기만                           | — (연락처는 `partner_bookings`)    | 전체 읽기 (소유자가 지워진 주문 포함)       |
| order_items · order_item_options                           | —                | 본인 것 읽기만                           | 본인 상품 항목 읽기, 처리는 함수   | 전체 읽기                                   |
| partner_applications                                       | —                | 본인 신청·읽기                           | 본인                               | 전체 + 승인·거절 함수                       |
| partners · settlements                                     | —                | —                                        | 본인                               | 전체 + 상태·정산 함수                       |
| reviews                                                    | 읽기 (숨김 제외) | 읽기, 이용 완료 상품에 작성, 본인 수정   | 같음                               | 숨긴 리뷰 포함 읽기 + 숨김 함수             |
| review_reports                                             | —                | 본인 신고·읽기 (본인 리뷰·중복 불가)     | 같음                               | 전체 + 처리 함수                            |
| likes · like_folders · trips · trip_items                  | —                | 본인 것만 (예약 항목은 만들기·삭제 불가) | 같음                               | 같음                                        |
| audit_logs                                                 | —                | —                                        | —                                  | 읽기만 (쓰기는 트리거)                      |
| order_memos                                                | —                | —                                        | —                                  | 읽기 · 남기기 (고치기·지우기 불가)          |
| refund_adjustments · settlement_adjustments                | —                | —                                        | 본인 조정 전표 읽기                | 읽기 (쓰기는 `admin_adjust_refund`)         |
| storage `review-photos` / `product-images`                 | 공개 URL로 보기  | 본인 폴더에만 리뷰 사진                  | 파트너 폴더에만 상품 사진          | —                                           |

쓰기 정책이나 GRANT가 없는 동작은 모두 거부된다. 예약 인원 카운터(`slot_inventory.booked`)·주문 상태·정산 기록은 누구도 직접 쓸 수 없고 함수만 바꾼다.
