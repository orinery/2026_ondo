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
      {
        // 주문으로 자동 추가된 예약 항목: "예약" 태그 + 예약 보기 링크, 삭제 버튼 없음
        id: "i7",
        time: "14:00",
        title: "교토 마치야 다도 체험",
        note: "예약번호 YO261015-000031",
        type: "booking",
        status: "upcoming",
        bookingHref: "/my/orders/YO261015-000031",
      },
    ],
  },
  {
    id: "d3",
    label: "Day 3 · 11.4",
    items: [],
  },
];

/** 5일 여행 — Day 탭이 줄바꿈되는 경우 (탭 틀이 늘어나고 아래 내용과 겹치지 않아야 한다) */
export const MOCK_LONG_ITINERARY: ItineraryDay[] = [
  ...MOCK_ITINERARY,
  { id: "d4", label: "Day 4 · 11.5", items: [] },
  { id: "d5", label: "Day 5 · 11.6", items: [] },
];
