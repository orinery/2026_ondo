import type { SeasonSlug } from "@/lib/constants/taxonomy";

/**
 * 메인 히어로의 계절별 문구·사진 (사용자 확정: 현재 계절 자동)
 * 가을은 명세 문구 그대로, 나머지 계절은 같은 톤으로 작성했다.
 * 사진은 시드에 쓰인(내용을 확인한) Unsplash 무료 이미지에서 고른다.
 */
const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`;

export const SEASON_EDITS: Record<
  SeasonSlug,
  { eyebrow: string; headline: [string, string]; image: string; imageAlt: string }
> = {
  spring: {
    eyebrow: "Spring edit",
    headline: ["이번 봄, 꽃잎이 먼저", "흩날리는 곳으로."],
    image: photo("1502602898657-3e91760cbb34"),
    imageAlt: "센강 너머로 보이는 파리의 에펠탑",
  },
  summer: {
    eyebrow: "Summer edit",
    headline: ["이번 여름, 바다가 가장", "파랗게 빛나는 곳으로."],
    image: photo("1570077188670-e3a8d69ac5ff"),
    imageAlt: "에게해를 내려다보는 산토리니의 하얀 마을과 파란 돔",
  },
  fall: {
    eyebrow: "Autumn edit",
    headline: ["이번 가을, 단풍이 먼저", "도착하는 곳으로."],
    image: photo("1493976040374-85c8e12f0c0e"),
    imageAlt: "야사카 탑이 보이는 교토 골목에 기모노를 입은 두 사람이 서 있다",
  },
  winter: {
    eyebrow: "Winter edit",
    headline: ["이번 겨울, 오로라가", "기다리는 곳으로."],
    image: photo("1509529711801-deac231925ac"),
    imageAlt: "키르큐펠 산 위로 펼쳐진 오로라",
  },
};

/** 메인 "테마별 컬렉션" (명세 4.1: 대형 1 + 소형 2) */
export const COLLECTIONS = [
  {
    theme: "sea",
    eyebrow: "By the sea",
    title: "파도 소리로 깨는 아침",
    label: "바다",
    image: photo("1507525428034-b723cf961d3e"),
    imageAlt: "맑은 바다와 하얀 백사장",
  },
  {
    theme: "nature",
    eyebrow: "On the ridge",
    title: "걷기 좋은 능선",
    label: "트레킹",
    image: photo("1506905925346-21bda4d32df4"),
    imageAlt: "구름 바다 위로 솟은 알프스 봉우리",
  },
  {
    theme: "city",
    eyebrow: "In the alleys",
    title: "골목을 걷는 도시",
    label: "도시·예술",
    image: photo("1502602898657-3e91760cbb34"),
    imageAlt: "센강 너머로 보이는 파리의 에펠탑",
  },
] as const;
