import type { CartItem } from "@/lib/data/cart";
import type { OrderSummary } from "@/lib/data/orders";

import { unsplash } from "./products";

/**
 * /dev/components(디자인 QA) 전용 — 장바구니·예약 내역 화면의 상태를 로그인 없이 보여주기 위한 목업.
 * 버튼(인원 변경·삭제·취소)은 실제 Server Action을 부르므로 데모에서는 "로그인 필요"로 실패한다.
 */
const standard = {
  code: "standard",
  name: "일반 취소",
  summary: "7일 전까지 100% · 3일 전까지 50% · 1일 전까지 20% 환불",
  tiers: [
    { daysBefore: 7, refundRate: 100 },
    { daysBefore: 3, refundRate: 50 },
    { daysBefore: 1, refundRate: 20 },
  ],
};

export const MOCK_CART: CartItem[] = [
  {
    id: "c1",
    useDate: "2026-11-21",
    adultQty: 2,
    childQty: 1,
    slot: { id: "s1", startTime: "08:00" },
    prices: { adultPrice: 89000, childPrice: 69000 },
    options: [],
    optionsAmount: 0,
    subtotal: 247000,
    error: null,
    product: {
      id: "p1",
      slug: "tokyo-fuji-kawaguchiko-bus",
      title: "후지산·가와구치코 당일 버스 투어",
      imageUrl: unsplash("1526481280693-3bfa7568e0f3", 400),
      imageAlt: "",
      cityName: "도쿄",
      startTime: "08:00",
      cancelPolicy: standard,
      adultPrice: 89000,
      childPrice: 69000,
      operatingDays: [1, 2, 3, 4, 5, 6, 7],
      cutoffDays: 2,
      maxQty: 10,
      unavailableReason: null,
    },
  },
  {
    id: "c2",
    useDate: "2026-10-16",
    adultQty: 2,
    childQty: 0,
    slot: { id: "s2", startTime: "14:00" },
    prices: { adultPrice: 38000, childPrice: 25000 },
    options: [],
    optionsAmount: 0,
    subtotal: 76000,
    // 담은 뒤 마감이 지나 주문할 수 없게 된 항목
    error: "cutoff",
    product: {
      id: "p2",
      slug: "kyoto-machiya-tea-ceremony",
      title: "교토 마치야 다도 체험",
      imageUrl: unsplash("1743515483156-6bf698521774", 400),
      imageAlt: "",
      cityName: "교토",
      startTime: "14:00",
      cancelPolicy: standard,
      adultPrice: 38000,
      childPrice: 25000,
      operatingDays: [1, 2, 4, 5, 6, 7],
      cutoffDays: 2,
      maxQty: 6,
      unavailableReason: null,
    },
  },
];

const orderItem = (
  id: string,
  title: string,
  slug: string,
  image: string,
  cityName: string,
  useDate: string,
  subtotal: number,
) => ({
  id,
  productId: id,
  productSlug: slug,
  productTitle: title,
  imageUrl: unsplash(image, 400),
  imageAlt: "",
  cityName,
  useDate,
  adultQty: 2,
  childQty: 0,
  adultPrice: subtotal / 2,
  childPrice: null,
  subtotal,
  refundAmount: null,
  cancelPolicy: standard,
});

export const MOCK_ORDERS: OrderSummary[] = [
  {
    id: "o1",
    orderNo: "YO261015-000031",
    status: "paid",
    displayStatus: "upcoming",
    cancellable: true,
    totalAmount: 178000,
    refundAmount: null,
    paidAt: "2026-10-15T03:00:00Z",
    cancelledAt: null,
    items: [
      orderItem(
        "i1",
        "후지산·가와구치코 당일 버스 투어",
        "tokyo-fuji-kawaguchiko-bus",
        "1526481280693-3bfa7568e0f3",
        "도쿄",
        "2026-11-21",
        178000,
      ),
    ],
  },
  {
    id: "o2",
    orderNo: "YO260828-000012",
    status: "paid",
    displayStatus: "used",
    cancellable: false,
    totalAmount: 138000,
    refundAmount: null,
    paidAt: "2026-08-28T03:00:00Z",
    cancelledAt: null,
    items: [
      orderItem(
        "i2",
        "도톤보리·신세카이 미식 워킹 투어",
        "osaka-dotonbori-food-walk",
        "1786472463035-c222e7fe89bb",
        "오사카",
        "2026-09-11",
        138000,
      ),
    ],
  },
  {
    id: "o3",
    orderNo: "YO260901-000015",
    status: "cancelled",
    displayStatus: "cancelled",
    cancellable: false,
    totalAmount: 72000,
    refundAmount: 72000,
    paidAt: "2026-09-01T03:00:00Z",
    cancelledAt: "2026-09-03T03:00:00Z",
    items: [
      orderItem(
        "i3",
        "츄라우미 수족관 입장권",
        "okinawa-churaumi-aquarium",
        "1612476919598-a233d3692cc6",
        "오키나와",
        "2026-09-20",
        72000,
      ),
    ],
  },
];
