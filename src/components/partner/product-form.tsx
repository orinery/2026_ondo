"use client";

import { ArrowDownIcon, ArrowUpIcon, ImagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { saveProduct } from "@/actions/partner-products";
import { FormField } from "@/components/form/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES,
  ITEM_TYPES,
  THEMES,
  type ConfirmationMode,
  type OptionUnit,
  type UserItemTypeSlug,
} from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE, productFormSchema, type ProductFormInput } from "@/lib/validation/product";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * 폼 상태: 입력창 그대로의 문자열로 들고 있다가(숫자 칸을 비워 둘 수 있게) 저장할 때 검증 스키마 모양으로 바꾼다.
 * 여러 줄 목록(포함·불포함 등)은 "한 줄 = 한 항목".
 */
type FormState = {
  slug: string;
  cityId: string;
  category: ProductFormInput["category"];
  theme: ProductFormInput["theme"];
  title: string;
  summary: string;
  description: string;
  highlights: string;
  images: { url: string; alt: string }[];
  adultPrice: string;
  childPrice: string; // "" = 성인 전용
  listAdultPrice: string;
  operatingDays: number[];
  cutoffDays: string;
  maxQty: string;
  durationText: string;
  includes: string;
  excludes: string;
  usageInfo: string;
  meetingPoint: string;
  latitude: string;
  longitude: string;
  cancelPolicy: string;
  unavailableReason: string;
  confirmationMode: ConfirmationMode;
  publish: boolean;
  slots: { startTime: string; capacity: string }[];
  options: { name: string; price: string; unit: OptionUnit }[];
  itinerary: {
    time: string;
    title: string;
    note: string;
    type: UserItemTypeSlug;
    caution: string;
  }[];
};

const toLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function toInput(f: FormState): unknown {
  return {
    ...f,
    highlights: toLines(f.highlights),
    includes: toLines(f.includes),
    excludes: toLines(f.excludes),
    usageInfo: toLines(f.usageInfo),
    adultPrice: f.adultPrice,
    childPrice: numOrNull(f.childPrice),
    listAdultPrice: numOrNull(f.listAdultPrice),
    unavailableReason: f.unavailableReason.trim() || null,
  };
}

function fromInput(v: ProductFormInput): FormState {
  return {
    ...v,
    highlights: v.highlights.join("\n"),
    includes: v.includes.join("\n"),
    excludes: v.excludes.join("\n"),
    usageInfo: v.usageInfo.join("\n"),
    adultPrice: String(v.adultPrice),
    childPrice: v.childPrice === null ? "" : String(v.childPrice),
    listAdultPrice: v.listAdultPrice === null ? "" : String(v.listAdultPrice),
    cutoffDays: String(v.cutoffDays),
    maxQty: String(v.maxQty),
    latitude: String(v.latitude),
    longitude: String(v.longitude),
    unavailableReason: v.unavailableReason ?? "",
    slots: v.slots.map((s) => ({ startTime: s.startTime, capacity: String(s.capacity) })),
    options: v.options.map((o) => ({ ...o, price: String(o.price) })),
  };
}

function emptyProduct(cityId: string): FormState {
  return {
    slug: "",
    cityId,
    category: "tour",
    theme: "culture",
    title: "",
    summary: "",
    description: "",
    highlights: "",
    images: [],
    adultPrice: "",
    childPrice: "",
    listAdultPrice: "",
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    cutoffDays: "1",
    maxQty: "10",
    durationText: "",
    includes: "",
    excludes: "",
    usageInfo: "",
    meetingPoint: "",
    latitude: "",
    longitude: "",
    cancelPolicy: "standard",
    unavailableReason: "",
    confirmationMode: "instant",
    publish: false,
    slots: [{ startTime: "10:00", capacity: "20" }],
    options: [],
    itinerary: [],
  };
}

type Choice = { value: string; label: string };

/**
 * 파트너 상품 등록·수정 폼 (하이파이에 없는 화면 — 기존 토큰·컴포넌트로 구성)
 * 저장은 saveProduct(Server Action) → DB save_product 하나로 상품·사진·일정·회차·옵션을 함께 저장한다.
 * 사진은 브라우저에서 Storage(파트너 폴더)로 바로 올린다 — 서버 함수 요청 크기 제한(약 4.5MB)을 피하기 위해 (리뷰 사진과 같은 방식).
 */
export function ProductForm({
  productId,
  partnerId,
  initial,
  cities,
  policies,
  suspendedReason,
}: {
  productId: string | null; // null = 새 상품
  partnerId: string;
  initial: ProductFormInput | null; // null = 빈 폼 (새 상품)
  cities: Choice[];
  policies: Choice[];
  suspendedReason: string | null;
}) {
  const router = useRouter();
  const uid = useId();
  const [f, setF] = useState<FormState>(() =>
    initial ? fromInput(initial) : emptyProduct(cities[0]?.value ?? ""),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));
  const id = (name: string) => `${uid}-${name}`;
  const err = (name: string) => errors[name];
  const described = (name: string) =>
    err(name) ? { "aria-invalid": true, "aria-describedby": `${id(name)}-error` } : {};

  /** 목록(사진·회차·옵션·일정) 공통: 바꾸기 · 지우기 · 위아래로 옮기기 */
  function listOps<K extends "images" | "slots" | "options" | "itinerary">(key: K) {
    type Row = FormState[K][number];
    const rows = f[key] as Row[];
    const write = (next: Row[]) => set(key, next as FormState[K]);
    return {
      update: (i: number, patch: Partial<Row>) =>
        write(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))),
      remove: (i: number) => write(rows.filter((_, k) => k !== i)),
      move: (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= rows.length) return;
        const next = [...rows];
        [next[i], next[j]] = [next[j] as Row, next[i] as Row];
        write(next);
      },
      add: (row: Row) => write([...rows, row]),
    };
  }

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFormError(null);
    const room = PRODUCT_IMAGE.max - f.images.length;
    const picked = [...files].slice(0, Math.max(room, 0));
    if (picked.length < files.length)
      setFormError(`사진은 ${PRODUCT_IMAGE.max}장까지 올릴 수 있어요.`);
    setUploading(true);
    const supabase = createClient();
    const added: { url: string; alt: string }[] = [];
    for (const file of picked) {
      if (!(PRODUCT_IMAGE.types as readonly string[]).includes(file.type)) {
        setFormError("JPG, PNG, WebP 사진만 올릴 수 있어요.");
        continue;
      }
      if (file.size > PRODUCT_IMAGE.maxBytes) {
        setFormError("사진은 한 장에 5MB 이하만 올릴 수 있어요.");
        continue;
      }
      const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      // 첫 폴더 = 내 파트너 id (Storage 정책이 이 폴더에만 올리게 한다)
      const path = `${partnerId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(PRODUCT_IMAGE.bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setFormError("사진을 올리지 못했어요. 다시 시도해 주세요.");
        continue;
      }
      const url = supabase.storage.from(PRODUCT_IMAGE.bucket).getPublicUrl(path).data.publicUrl;
      added.push({ url, alt: "" });
    }
    setF((prev) => ({ ...prev, images: [...prev.images, ...added] }));
    setUploading(false);
  };

  const submit = () => {
    setFormError(null);
    const parsed = productFormSchema.safeParse(toInput(f));
    if (!parsed.success) {
      // 칸별 첫 오류만 (예: "images", "slots")
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      setFormError("입력한 내용을 확인해 주세요. 빨간 안내가 있는 칸을 고쳐야 저장할 수 있어요.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveProduct(productId, parsed.data);
      if (!result.ok) {
        setFormError(
          result.reason === "unauthenticated"
            ? "로그인이 필요해요. 다시 로그인해 주세요."
            : (result.message ?? "저장하지 못했어요. 잠시 후 다시 시도해 주세요."),
        );
        return;
      }
      router.push(`/partner/products?saved=${result.id}`);
    });
  };

  const images = listOps("images");
  const slots = listOps("slots");
  const options = listOps("options");
  const itinerary = listOps("itinerary");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      {suspendedReason && (
        <p role="status" className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
          <span className="font-semibold text-destructive">관리자가 판매를 중지한 상품이에요.</span>{" "}
          사유: {suspendedReason}. 내용은 고칠 수 있지만 판매는 관리자가 다시 열어야 해요.
        </p>
      )}

      <Section title="기본 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id={id("title")} label="상품명" error={err("title")} className="md:col-span-2">
            <Input
              id={id("title")}
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={60}
              className="h-11"
              {...described("title")}
            />
          </FormField>
          <FormField
            id={id("slug")}
            label="상품 주소"
            error={err("slug")}
            hint={
              productId
                ? "주소는 처음 만들 때만 정할 수 있어요."
                : "영문 소문자·숫자·하이픈 (예: kyoto-night-walk)"
            }
          >
            <Input
              id={id("slug")}
              value={f.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              disabled={productId !== null}
              maxLength={60}
              className="h-11"
              {...described("slug")}
            />
          </FormField>
          <SelectField
            id={id("city")}
            label="도시"
            value={f.cityId}
            onChange={(v) => set("cityId", v)}
            choices={cities}
            error={err("cityId")}
          />
          <SelectField
            id={id("category")}
            label="종류"
            value={f.category}
            onChange={(v) => set("category", v as FormState["category"])}
            choices={CATEGORIES}
          />
          <SelectField
            id={id("theme")}
            label="테마"
            value={f.theme}
            onChange={(v) => set("theme", v as FormState["theme"])}
            choices={THEMES}
          />
          <FormField
            id={id("summary")}
            label="한 줄 소개"
            error={err("summary")}
            className="md:col-span-2"
          >
            <Input
              id={id("summary")}
              value={f.summary}
              onChange={(e) => set("summary", e.target.value)}
              maxLength={120}
              className="h-11"
              {...described("summary")}
            />
          </FormField>
          <FormField
            id={id("description")}
            label="상품 소개"
            error={err("description")}
            className="md:col-span-2"
          >
            <Textarea
              id={id("description")}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              maxLength={2000}
              {...described("description")}
            />
          </FormField>
          <FormField
            id={id("highlights")}
            label="포인트 (한 줄에 하나)"
            error={err("highlights")}
            className="md:col-span-2"
          >
            <Textarea
              id={id("highlights")}
              value={f.highlights}
              onChange={(e) => set("highlights", e.target.value)}
              rows={3}
              {...described("highlights")}
            />
          </FormField>
        </div>
      </Section>

      <Section
        title="사진"
        description={`첫 번째 사진이 대표 사진이 돼요. 최대 ${PRODUCT_IMAGE.max}장, 한 장 5MB 이하 (JPG·PNG·WebP).`}
        error={err("images")}
        errorId={`${id("images")}-error`}
      >
        <ul className="flex flex-col gap-3">
          {f.images.map((img, i) => (
            <li
              key={img.url}
              className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center"
            >
              <span className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-sm bg-muted md:w-32">
                <Image src={img.url} alt="" fill sizes="128px" className="object-cover" />
              </span>
              <FormField
                id={id(`img-${i}`)}
                label={i === 0 ? "사진 설명 (대표)" : "사진 설명"}
                className="min-w-0 flex-1"
              >
                <Input
                  id={id(`img-${i}`)}
                  value={img.alt}
                  onChange={(e) => images.update(i, { alt: e.target.value })}
                  maxLength={120}
                  placeholder="사진에 보이는 것 (예: 저녁 노을이 지는 기온 거리)"
                  className="h-11"
                />
              </FormField>
              <RowActions
                label={`사진 ${i + 1}`}
                onUp={i > 0 ? () => images.move(i, -1) : undefined}
                onDown={i < f.images.length - 1 ? () => images.move(i, 1) : undefined}
                onRemove={() => images.remove(i)}
              />
            </li>
          ))}
        </ul>
        <label
          className={cn(
            "flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-md border border-dashed px-4 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            (uploading || f.images.length >= PRODUCT_IMAGE.max) && "pointer-events-none opacity-50",
          )}
        >
          <ImagePlusIcon aria-hidden className="size-4" />
          {uploading ? "올리는 중…" : "사진 올리기"}
          <input
            type="file"
            accept={PRODUCT_IMAGE.types.join(",")}
            multiple
            className="sr-only"
            disabled={uploading || f.images.length >= PRODUCT_IMAGE.max}
            onChange={(e) => {
              void uploadImages(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </Section>

      <Section title="가격 · 인원">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NumberField
            id={id("adult")}
            label="성인 가격 (원)"
            value={f.adultPrice}
            onChange={(v) => set("adultPrice", v)}
            error={err("adultPrice")}
          />
          <NumberField
            id={id("child")}
            label="아동 가격 (원)"
            value={f.childPrice}
            onChange={(v) => set("childPrice", v)}
            error={err("childPrice")}
            hint="비우면 성인 전용 상품"
          />
          <NumberField
            id={id("list")}
            label="정가 (원, 선택)"
            value={f.listAdultPrice}
            onChange={(v) => set("listAdultPrice", v)}
            error={err("listAdultPrice")}
            hint="판매가보다 크면 할인율로 표시"
          />
          <NumberField
            id={id("max")}
            label="한 번에 예약할 수 있는 인원"
            value={f.maxQty}
            onChange={(v) => set("maxQty", v)}
            error={err("maxQty")}
          />
        </div>
      </Section>

      <Section title="운영">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">운영 요일</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, i) => {
              const day = i + 1;
              const on = f.operatingDays.includes(day);
              return (
                <label
                  key={label}
                  className={cn(
                    "grid size-11 cursor-pointer place-items-center rounded-full border text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    on ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      set(
                        "operatingDays",
                        on ? f.operatingDays.filter((d) => d !== day) : [...f.operatingDays, day],
                      )
                    }
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {err("operatingDays") && (
            <p className="text-sm text-destructive">{err("operatingDays")}</p>
          )}
        </fieldset>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NumberField
            id={id("cutoff")}
            label="예약 마감 (이용 며칠 전)"
            value={f.cutoffDays}
            onChange={(v) => set("cutoffDays", v)}
            error={err("cutoffDays")}
            hint="0 = 당일까지"
          />
          <FormField id={id("duration")} label="소요 시간" error={err("durationText")}>
            <Input
              id={id("duration")}
              value={f.durationText}
              onChange={(e) => set("durationText", e.target.value)}
              placeholder="약 3시간"
              maxLength={30}
              className="h-11"
              {...described("durationText")}
            />
          </FormField>
          <SelectField
            id={id("policy")}
            label="취소 규정"
            value={f.cancelPolicy}
            onChange={(v) => set("cancelPolicy", v)}
            choices={policies}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">예약 확정 방식</legend>
          {(
            [
              ["instant", "즉시 확정", "결제하면 바로 확정되고 바우처가 발급돼요."],
              [
                "manual",
                "파트너 확정",
                "결제 후 48시간 안에(이용일 전까지) 직접 확정하거나 거절해요. 처리하지 않으면 자동 취소·전액 환불돼요.",
              ],
            ] as const
          ).map(([value, label, description]) => (
            <label key={value} className="flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name={id("mode")}
                value={value}
                checked={f.confirmationMode === value}
                onChange={() => set("confirmationMode", value)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Section>

      <Section
        title="회차"
        description="시간마다 기본 정원을 정해요. 날짜별 정원·마감·가격은 저장한 뒤 재고 관리에서 바꿀 수 있어요. 시간을 비우면 종일권(시간 없음)."
        error={err("slots")}
        errorId={`${id("slots")}-error`}
      >
        <ul className="flex flex-col gap-3">
          {f.slots.map((s, i) => (
            <li key={i} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
              <FormField id={id(`slot-t-${i}`)} label="시작 시간" className="w-36">
                <Input
                  id={id(`slot-t-${i}`)}
                  type="time"
                  value={s.startTime}
                  onChange={(e) => slots.update(i, { startTime: e.target.value })}
                  className="h-11"
                />
              </FormField>
              <FormField id={id(`slot-c-${i}`)} label="기본 정원" className="w-28">
                <Input
                  id={id(`slot-c-${i}`)}
                  inputMode="numeric"
                  value={s.capacity}
                  onChange={(e) => slots.update(i, { capacity: e.target.value })}
                  className="h-11"
                />
              </FormField>
              <RowActions
                label={`회차 ${i + 1}`}
                onUp={i > 0 ? () => slots.move(i, -1) : undefined}
                onDown={i < f.slots.length - 1 ? () => slots.move(i, 1) : undefined}
                onRemove={f.slots.length > 1 ? () => slots.remove(i) : undefined}
              />
            </li>
          ))}
        </ul>
        <AddButton
          disabled={f.slots.length >= 6}
          onClick={() => slots.add({ startTime: "", capacity: "20" })}
        >
          회차 추가
        </AddButton>
      </Section>

      <Section
        title="추가 옵션"
        description="예: 호텔 픽업 (건당), 점심 도시락 (1인당). 최대 10개."
        error={err("options")}
        errorId={`${id("options")}-error`}
      >
        <ul className="flex flex-col gap-3">
          {f.options.map((o, i) => (
            <li key={i} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
              <FormField id={id(`opt-n-${i}`)} label="이름" className="min-w-40 flex-1">
                <Input
                  id={id(`opt-n-${i}`)}
                  value={o.name}
                  onChange={(e) => options.update(i, { name: e.target.value })}
                  maxLength={30}
                  className="h-11"
                />
              </FormField>
              <FormField id={id(`opt-p-${i}`)} label="가격 (원)" className="w-32">
                <Input
                  id={id(`opt-p-${i}`)}
                  inputMode="numeric"
                  value={o.price}
                  onChange={(e) => options.update(i, { price: e.target.value })}
                  className="h-11"
                />
              </FormField>
              <SelectField
                id={id(`opt-u-${i}`)}
                label="단위"
                value={o.unit}
                onChange={(v) => options.update(i, { unit: v as OptionUnit })}
                choices={[
                  { value: "per_booking", label: "건당" },
                  { value: "per_person", label: "1인당" },
                ]}
                className="w-28"
              />
              <RowActions label={`옵션 ${i + 1}`} onRemove={() => options.remove(i)} />
            </li>
          ))}
        </ul>
        <AddButton
          disabled={f.options.length >= 10}
          onClick={() => options.add({ name: "", price: "", unit: "per_booking" })}
        >
          옵션 추가
        </AddButton>
      </Section>

      <Section title="상세 안내">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              ["includes", "포함 사항"],
              ["excludes", "불포함 사항"],
              ["usageInfo", "이용 안내"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} id={id(key)} label={`${label} (한 줄에 하나)`} error={err(key)}>
              <Textarea
                id={id(key)}
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
                rows={5}
                {...described(key)}
              />
            </FormField>
          ))}
        </div>
      </Section>

      <Section
        title="진행 일정 (선택)"
        description="투어의 하루 코스. 상세 페이지 타임라인으로 보여요."
        error={err("itinerary")}
        errorId={`${id("itinerary")}-error`}
      >
        <ul className="flex flex-col gap-3">
          {f.itinerary.map((it, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[8rem_1fr_8rem_auto] md:items-end"
            >
              <FormField id={id(`it-t-${i}`)} label="시간">
                <Input
                  id={id(`it-t-${i}`)}
                  type="time"
                  value={it.time}
                  onChange={(e) => itinerary.update(i, { time: e.target.value })}
                  className="h-11"
                />
              </FormField>
              <FormField id={id(`it-n-${i}`)} label="제목">
                <Input
                  id={id(`it-n-${i}`)}
                  value={it.title}
                  onChange={(e) => itinerary.update(i, { title: e.target.value })}
                  maxLength={60}
                  className="h-11"
                />
              </FormField>
              <SelectField
                id={id(`it-y-${i}`)}
                label="유형"
                value={it.type}
                onChange={(v) => itinerary.update(i, { type: v as UserItemTypeSlug })}
                choices={ITEM_TYPES}
              />
              <RowActions
                label={`일정 ${i + 1}`}
                onUp={i > 0 ? () => itinerary.move(i, -1) : undefined}
                onDown={i < f.itinerary.length - 1 ? () => itinerary.move(i, 1) : undefined}
                onRemove={() => itinerary.remove(i)}
              />
              <FormField id={id(`it-m-${i}`)} label="메모 (선택)" className="md:col-span-2">
                <Input
                  id={id(`it-m-${i}`)}
                  value={it.note}
                  onChange={(e) => itinerary.update(i, { note: e.target.value })}
                  maxLength={200}
                  className="h-11"
                />
              </FormField>
              <FormField id={id(`it-c-${i}`)} label="주의 (선택)" className="md:col-span-2">
                <Input
                  id={id(`it-c-${i}`)}
                  value={it.caution}
                  onChange={(e) => itinerary.update(i, { caution: e.target.value })}
                  maxLength={60}
                  placeholder="예: 수요일 휴관"
                  className="h-11"
                />
              </FormField>
            </li>
          ))}
        </ul>
        <AddButton
          disabled={f.itinerary.length >= 15}
          onClick={() =>
            itinerary.add({ time: "", title: "", note: "", type: "sight", caution: "" })
          }
        >
          일정 추가
        </AddButton>
      </Section>

      <Section
        title="만나는 장소"
        description="투어는 만나는 장소, 티켓은 이용 장소. 좌표는 상세 페이지 지도에 쓰여요."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField id={id("meeting")} label="장소" error={err("meetingPoint")}>
            <Input
              id={id("meeting")}
              value={f.meetingPoint}
              onChange={(e) => set("meetingPoint", e.target.value)}
              maxLength={100}
              className="h-11"
              {...described("meetingPoint")}
            />
          </FormField>
          <NumberField
            id={id("lat")}
            label="위도"
            value={f.latitude}
            onChange={(v) => set("latitude", v)}
            error={err("latitude")}
            hint="예: 35.0037"
            decimal
          />
          <NumberField
            id={id("lng")}
            label="경도"
            value={f.longitude}
            onChange={(v) => set("longitude", v)}
            error={err("longitude")}
            hint="예: 135.7788"
            decimal
          />
        </div>
      </Section>

      <Section title="판매 상태">
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            checked={f.publish}
            onCheckedChange={(on) => set("publish", on === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">판매 시작 (공개)</span>
            <span className="block text-muted-foreground">
              끄면 임시 저장 — 나와 관리자만 볼 수 있어요. 이미 받은 예약은 그대로 유지돼요.
            </span>
          </span>
        </label>
        <FormField
          id={id("pause")}
          label="판매 일시 중단 사유 (선택)"
          hint="적으면 공개 상태 그대로 '예약 불가'로 보여요. 예: 2026-27 시즌 준비 중"
          error={err("unavailableReason")}
        >
          <Input
            id={id("pause")}
            value={f.unavailableReason}
            onChange={(e) => set("unavailableReason", e.target.value)}
            maxLength={60}
            className="h-11"
          />
        </FormField>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:flex-row md:items-center md:justify-end md:px-8">
        {formError && (
          <p role="alert" className="text-sm text-destructive md:mr-auto">
            {formError}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-md px-5"
          onClick={() => router.back()}
          disabled={pending}
        >
          취소
        </Button>
        <Button
          type="submit"
          className="h-11 rounded-md px-6 font-semibold"
          disabled={pending || uploading}
        >
          {pending ? "저장하는 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  error,
  errorId,
  children,
}: {
  title: string;
  description?: string;
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6"
    >
      <div>
        <h2 id={headingId} className="font-kr text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  choices,
  error,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: readonly Choice[];
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span id={`${id}-label`} className="mb-1.5 block text-sm font-medium">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-labelledby={`${id}-label`}
          aria-invalid={Boolean(error) || undefined}
          className="h-11! w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  decimal = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  decimal?: boolean;
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11"
      />
    </FormField>
  );
}

/** 목록 행의 위·아래·삭제 버튼 (없는 동작은 숨긴다) */
function RowActions({
  label,
  onUp,
  onDown,
  onRemove,
}: {
  label: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {onUp && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${label} 위로`}
          onClick={onUp}
          className="size-11"
        >
          <ArrowUpIcon aria-hidden className="size-4" />
        </Button>
      )}
      {onDown && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${label} 아래로`}
          onClick={onDown}
          className="size-11"
        >
          <ArrowDownIcon aria-hidden className="size-4" />
        </Button>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${label} 삭제`}
          onClick={onRemove}
          className="size-11"
        >
          <Trash2Icon aria-hidden className="size-4" />
        </Button>
      )}
    </div>
  );
}

function AddButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 self-start rounded-md"
      onClick={onClick}
      disabled={disabled}
    >
      <PlusIcon aria-hidden className="size-4" />
      {children}
    </Button>
  );
}
