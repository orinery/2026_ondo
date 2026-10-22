# Vercel 배포 가이드

무료 티어(Vercel Hobby + Supabase Free)만으로 배포한다.
DB 마이그레이션·시드는 **로컬에서** 실행하고, Vercel은 Next.js 앱만 빌드·실행한다.

```
[로컬]  npm run db:migrate / db:seed / db:verify-rls ──▶ Supabase (Postgres·Auth·Storage)
[Vercel] next build → 서버 함수(SSR·Server Actions·Proxy) ──▶ Supabase (publishable 키 + 사용자 JWT, RLS 적용)
```

## 0. 준비물

- GitHub 저장소 (이 프로젝트: `orinery/2026_ondo`)
- 마이그레이션(0000~0025)·시드를 마친 Supabase 프로젝트 (로컬 `.env.local`로 이미 연결된 것)
  - 0014가 **pg_cron 확장 설치**와 10분 주기 작업(`expire-pending-items`), 상품 사진 **Storage 버킷**(`product-images`)을 만든다. 따로 대시보드에서 켤 필요는 없다(아래 4-1절에서 확인)
- Vercel 계정 (GitHub로 로그인)

## 1. 배포 전 로컬 확인

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

DB가 최신 상태인지 확인한다 (새 마이그레이션이 있으면 먼저 적용).

```bash
npm run db:migrate
```

```bash
npm run db:verify-rls
```

```bash
npm run db:verify-race
```

> 시드니 리전까지 왕복이 수백 ms라 `db:verify-rls`(254개 시나리오)는 몇 분 걸린다. 멈춘 것이 아니다.

## 2. Vercel 프로젝트 만들기

웹 화면이나 CLI 중 하나로 만든다. 이 프로젝트는 **CLI로 배포**했다 (2026-10-21, https://2026-ondo.vercel.app).

### 방법 A — 웹 화면

1. [vercel.com/new](https://vercel.com/new) → GitHub 저장소 `2026_ondo` → **Import**
2. Framework Preset: **Next.js**. Build Command·Output Directory는 기본값 그대로
3. **Deploy를 누르기 전에** 아래 환경 변수를 먼저 입력한다

### 방법 B — CLI (실제로 사용한 방법)

```bash
npx vercel login
```

```bash
npx vercel project create 2026-ondo
```

```bash
npx vercel link --yes --project 2026-ondo
```

환경 변수 3개를 넣은 뒤(아래 표, `npx vercel env add <이름> production` — 값은 입력 프롬프트에 붙여 넣는다) 배포한다.

```bash
npx vercel deploy --prod
```

```bash
npx vercel git connect
```

마지막 명령으로 GitHub 저장소를 연결하면 이후에는 `main`에 푸시할 때마다 자동으로 배포된다.

**저장소에 둔 배포 설정**

- [`vercel.json`](../vercel.json) — `framework: "nextjs"`, `regions: ["syd1"]`. CLI로 빈 프로젝트를 먼저 만들면 프레임워크가 비어 "Output Directory `public` is empty"로 실패한다(실제로 겪음). 파일로 고정해 두면 어떤 방법으로 만들어도 같다.
- [`.vercelignore`](../.vercelignore) — CLI 배포 시 업로드 제외 목록. `.env*`(비밀 값)을 절대 올리지 않는다. Git 연결 배포는 커밋된 파일만 쓰지만, CLI 배포는 로컬 폴더를 올리기 때문에 필요하다.

> `vercel link`는 `.env.local`에 `VERCEL_OIDC_TOKEN`을 추가하고 `.gitignore`에 규칙을 덧붙인다. 기존 값은 유지되며, `.gitignore`에 이미 있는 규칙이면 덧붙인 줄은 되돌려도 된다.

### 환경 변수

`NEXT_PUBLIC_` 변수는 **빌드할 때 코드에 박힌다**(Next.js 문서). 첫 빌드 전에 넣어야 하고, 값을 바꾸면 **다시 배포**해야 반영된다. 값이 없으면 `src/lib/env.ts`의 검증에 걸려 빌드가 실패한다(잘못된 설정으로 배포되는 것을 막기 위해 의도한 동작).

| 이름                                   | 값                                                            | 환경                |
| -------------------------------------- | ------------------------------------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`과 같은 값                                        | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`과 같은 값 (publishable 키)                       | Production, Preview |
| `NEXT_PUBLIC_SITE_URL`                 | 배포 주소, 예: `https://2026-ondo.vercel.app` (끝에 `/` 없이) | Production, Preview |

**Vercel에 넣지 않는 값**: `DATABASE_URL`, `SUPABASE_SECRET_KEY`.
이 둘은 로컬 스크립트(마이그레이션·시드·RLS 검증)만 쓰고 앱 코드는 쓰지 않는다. 쓰지 않는 비밀 값을 서버에 두지 않는 것이 가장 안전하다.

> 배포 주소를 아직 모르면 일단 임시 값으로 배포한 뒤, 주소가 정해지면 `NEXT_PUBLIC_SITE_URL`을 고치고 **Redeploy**한다.

## 3. Supabase 인증 URL 설정

이메일 인증 링크가 배포 주소로 돌아오도록 설정한다.

Supabase 대시보드 → **Authentication → URL Configuration**

| 항목          | 값                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Site URL      | `https://2026-ondo.vercel.app` (실제 배포 주소)                                                                  |
| Redirect URLs | `https://2026-ondo.vercel.app/auth/callback` (기존 `http://localhost:3000/auth/callback`은 로컬 개발용으로 유지) |

Preview 배포(브랜치·PR마다 생기는 주소)에서도 인증 메일을 테스트하려면 Redirect URLs에 Preview 주소 패턴을 추가한다. 단, 회원가입 시 돌아갈 주소는 `NEXT_PUBLIC_SITE_URL`로 만들기 때문에 Preview에서 가입해도 인증 링크는 그 값(보통 Production 주소)으로 돌아간다.

## 4. 리전 (응답 속도)

서버 함수와 Supabase가 멀리 떨어져 있으면 요청마다 왕복 시간이 쌓인다(8단계 점검: 페이지당 200~600ms가 대부분 DB 왕복).

- 현재 Supabase 프로젝트 리전: **ap-southeast-2 (시드니)**
- 서버 함수 리전은 [`vercel.json`](../vercel.json)의 `regions: ["syd1"]`(시드니)로 Supabase와 맞췄다. 응답 헤더 `x-vercel-id: icn1::syd1::…`(서울 엣지 → 시드니 함수)로 확인할 수 있다.
- 배포 후 한국에서 측정한 응답: 페이지당 0.6~1.1초 (서울 ↔ 시드니 왕복 포함)
- 사용자 대부분이 한국이라면 Supabase를 서울(ap-northeast-2)에 새로 만들고 Vercel도 서울 리전으로 맞추는 것이 가장 빠르다. Supabase는 프로젝트 리전을 옮길 수 없으므로 새 프로젝트에 마이그레이션·시드를 다시 실행해야 한다.

## 4-1. pg_cron · Storage 확인

Supabase 대시보드 → **SQL Editor**에서 확인한다.

```sql
select jobname, schedule, command, active from cron.job;
```

`expire-pending-items` · `*/10 * * * *` · `select public.expire_pending_items()` · `true`가 보이면 된다. 실행 기록은 `cron.job_run_details`에 남는다.
**Storage → Buckets**에 `review-photos`와 `product-images`(둘 다 Public, 5MB, JPG·PNG·WebP)가 있어야 한다.

## 5. 배포 후 확인

| 확인                                   | 기대 결과                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `/`                                    | 계절 히어로(도시·이용일·종류 검색), 인기 상품 8개, 도시 6곳, 테마 컬렉션   |
| `/products?city=kyoto`                 | 교토 상품 4개, 탭 제목 "교토 상품"                                         |
| `/products/tokyo-fuji-kawaguchiko-bus` | 갤러리·예약 위젯(달력·인원·총액)·진행 일정·취소 규정·리뷰 2개(구매 인증)   |
| `/products/atlantis`                   | "상품을 찾을 수 없어요" + **HTTP 404**                                     |
| `/destinations/kyoto`                  | **308** → `/products?city=kyoto` (전환 전 주소)                            |
| `/cart`, `/my` (비로그인)              | `/login?next=…`로 이동                                                     |
| 회원가입 → 인증 메일 링크              | 배포 주소의 `/auth/callback` → `/my`                                       |
| 장바구니 담기 → 주문서 → 결제          | 완료 화면, 나의 여행 > 예약 내역·일정 플래너(예약 항목)에 표시             |
| 예약 상세 → 예약 취소                  | 환불 예정액 확인 → 상태 "취소", 플래너에서 예약 항목(과 빈 자동 여행) 삭제 |
| 찜 → 새로고침                          | 하트 유지, `/my?tab=likes`에 표시                                          |
| 리뷰 (이용을 마친 상품)                | 리뷰 작성·사진 업로드, 구매 인증 배지                                      |
| 상품 상세 예약 위젯                    | 회차별 남은 자리, 매진 날짜 취소선, 추가 옵션, 파트너 확정 상품 안내       |
| 파트너 확정 상품 결제 → 예약 상세      | "확정 대기"와 처리 기한, 파트너가 확정하면 바우처(QR)                      |
| `/partner-apply` → `/admin/partners`   | 신청 → 관리자 승인 → 신청한 계정 메뉴에 "파트너 센터"                      |
| `/partner` (파트너 계정)               | 상품 등록·재고 관리·예약 확정/거절·바우처 사용 처리·정산                   |
| `/admin` (관리자 계정)                 | 대시보드 차트, 파트너·상품·주문·리뷰 신고·정산 / 관리자가 아니면 **404**   |

상태 코드는 아래 명령으로 확인할 수 있다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://2026-ondo.vercel.app/products/atlantis
```

## 6. 이후 변경 반영

- 코드: `main`에 푸시하면 Vercel이 자동으로 다시 배포한다
- DB 스키마: `src/db/schema.ts` 수정 → `npm run db:generate` → `npm run db:migrate` → `npm run db:types` → 코드 수정 후 푸시
  (마이그레이션은 배포 **전에** 적용해야 새 코드가 없는 컬럼을 조회하는 일이 없다)
- 환경 변수 변경: Vercel에서 값 수정 → **Redeploy**

## 무료 티어에서 알아둘 점

| 항목                | 내용                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Supabase 일시 정지  | 무료 프로젝트는 일정 기간 활동이 없으면 일시 정지된다. 대시보드에서 다시 켤 수 있다 (기간은 Supabase 정책 확인) |
| pg_cron             | 일시 정지 동안은 자동 취소가 돌지 않는다. 파트너·고객 화면을 열 때 같은 함수를 한 번 더 불러 보완한다           |
| 인증 메일 발송 한도 | 기본 메일 발송은 시간당 한도가 매우 낮다. 데모가 많다면 커스텀 SMTP를 연결하거나 이메일 인증을 끈다             |
| Vercel 요청 크기    | 서버 함수 요청 본문 약 4.5MB 제한 → 리뷰·상품 사진(최대 5MB)은 브라우저에서 Storage로 직접 올리도록 설계됨      |
| 이미지 최적화       | `next/image` 변환 횟수에 무료 한도가 있다. Unsplash·Storage 이미지 모두 최적화 대상                             |
