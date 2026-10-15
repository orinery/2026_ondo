import type { SeasonSlug, ThemeSlug } from "@/lib/constants/taxonomy";

/**
 * 메인 히어로의 계절별 문구·사진 (사용자 확정: 현재 계절 자동)
 * 가을은 명세 문구 그대로, 나머지 계절은 같은 톤으로 작성했다.
 * 사진은 시드에 쓰인(한 화면에 모아 내용을 확인한) Unsplash 무료 이미지에서 고른다.
 */
const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`;

export const SEASON_EDITS: Record<
  SeasonSlug,
  { eyebrow: string; headline: [string, string]; image: string; imageAlt: string }
> = {
  spring: {
    eyebrow: "Spring edit",
    headline: ["이번 봄, 벚꽃이 먼저", "피어나는 곳으로."],
    image: photo("1524413840807-0c3cb6fa808d"),
    imageAlt: "밤 조명을 받은 벚꽃 터널과 운하",
  },
  summer: {
    eyebrow: "Summer edit",
    headline: ["이번 여름, 바다가 가장", "파랗게 빛나는 곳으로."],
    image: photo("1542210749788-c3148c53bc5f"),
    imageAlt: "하얀 모래사장과 에메랄드빛 바다 너머의 섬",
  },
  fall: {
    eyebrow: "Autumn edit",
    headline: ["이번 가을, 단풍이 먼저", "도착하는 곳으로."],
    image: photo("1493976040374-85c8e12f0c0e"),
    imageAlt: "야사카 탑이 보이는 교토 골목에 기모노를 입은 두 사람이 서 있다",
  },
  winter: {
    eyebrow: "Winter edit",
    headline: ["이번 겨울, 눈이 가장 먼저", "내리는 곳으로."],
    image: photo("1735298954705-b38de4186813"),
    imageAlt: "눈 덮인 들판에 홀로 선 나무",
  },
};

/** 메인 "테마별 컬렉션" (명세 4.1: 대형 1 + 소형 2) */
export const COLLECTIONS: {
  theme: ThemeSlug;
  eyebrow: string;
  title: string;
  label: string;
  image: string;
  imageAlt: string;
}[] = [
  {
    theme: "sea",
    eyebrow: "By the sea",
    title: "파도 소리로 깨는 아침",
    label: "바다",
    image: photo("1785733249951-4d7bc8fb8472"),
    imageAlt: "바위섬과 긴 다리가 보이는 백사장",
  },
  {
    theme: "nature",
    eyebrow: "Into the wild",
    title: "꽃밭과 온천으로 떠나는 하루",
    label: "자연",
    image: photo("1629725593792-727bbe2255b2"),
    imageAlt: "줄무늬처럼 펼쳐진 형형색색 꽃밭",
  },
  {
    theme: "city",
    eyebrow: "City lights",
    title: "밤이 더 빛나는 도시",
    label: "도시",
    image: photo("1592499494890-da4507c0c7d8"),
    imageAlt: "벚꽃 너머로 올려다본 도쿄 스카이트리",
  },
];
