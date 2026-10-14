import type { ItineraryDay } from "@/types/itinerary";

/** 명세 5.4 하이파이 시안의 교토 3일 일정 (2단계 확인용 목업) */
export const MOCK_ITINERARY: ItineraryDay[] = [
  {
    id: "d1",
    label: "Day 1 · 11.2",
    items: [
      {
        id: "i1",
        time: "11:00",
        title: "간사이공항 → 교토역",
        note: "하루카 특급 · 75분",
        type: "move",
        status: "done",
      },
      {
        id: "i2",
        time: "14:00",
        title: "기온 · 하나미코지 산책",
        note: "골목 걷기 · 2시간",
        type: "sight",
        status: "current",
      },
      {
        id: "i3",
        time: "18:30",
        title: "폰토초 저녁",
        note: "가모강 테라스석 예약",
        type: "food",
        status: "upcoming",
      },
    ],
  },
  {
    id: "d2",
    label: "Day 2 · 11.3",
    items: [
      {
        id: "i4",
        time: "07:30",
        title: "후시미 이나리 신사",
        note: "이른 아침 추천 · 센본도리이",
        type: "sight",
        status: "upcoming",
      },
      {
        id: "i5",
        time: "12:00",
        title: "니시키 시장",
        note: "점심 · 길거리 음식",
        type: "food",
        status: "upcoming",
        closedReason: "수요일 휴무",
      },
      {
        id: "i6",
        time: "16:00",
        title: "기요미즈데라",
        note: "노을 시간대 · 1.5시간",
        type: "sight",
        status: "upcoming",
      },
    ],
  },
  {
    id: "d3",
    label: "Day 3 · 11.4",
    items: [],
  },
];
