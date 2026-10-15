"use client";

import { ImagePlusIcon, Loader2Icon, PencilIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { deleteReview, saveReview } from "@/actions/reviews";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { REVIEW_PHOTO, reviewSchema, validatePhoto } from "@/lib/validation/review";

export type MyReview = {
  id: string;
  rating: number;
  content: string;
  photoUrl: string | null;
};

type ReviewDialogProps = {
  destinationId: string;
  slug: string;
  destinationName: string;
  userId: string | null; // null = 비로그인
  myReview: MyReview | null; // 이미 쓴 리뷰가 있으면 수정 모드 (여행지당 1개)
};

// 사진 상태: 기존 유지 / 새 파일 / 삭제
type PhotoState =
  { kind: "keep" } | { kind: "new"; file: File; previewUrl: string } | { kind: "remove" };

type FieldErrors = { rating?: string; content?: string; photo?: string };

/**
 * 리뷰 쓰기·수정 다이얼로그 (사용자 확정: 버튼 → 다이얼로그, 767 이하 하단 시트 형태)
 *
 * 저장 순서
 * 1) 입력 검증 (서버와 같은 Zod 스키마)
 * 2) 새 사진이 있으면 브라우저에서 Storage에 직접 업로드 ("{내 id}/{무작위}.확장자", Storage 정책이 본인 폴더만 허용)
 * 3) Server Action으로 리뷰 저장 — 실패하면 2)에서 올린 사진을 지워 고아 파일을 남기지 않는다
 */
export function ReviewDialog({
  destinationId,
  slug,
  destinationName,
  userId,
  myReview,
}: ReviewDialogProps) {
  const isEdit = Boolean(myReview);

  // 비로그인: 로그인 후 이 페이지로 돌아오게 한다
  if (!userId) {
    return (
      <Button asChild variant="outline" className="h-10 rounded-md px-4">
        <Link href={`/login?next=${encodeURIComponent(`/destinations/${slug}`)}`}>
          로그인하고 리뷰 쓰기
        </Link>
      </Button>
    );
  }

  return (
    <ReviewDialogInner
      key={myReview ? `${myReview.id}-${myReview.rating}-${myReview.content.length}` : "new"}
      destinationId={destinationId}
      slug={slug}
      destinationName={destinationName}
      userId={userId}
      myReview={myReview}
      isEdit={isEdit}
    />
  );
}

function ReviewDialogInner({
  destinationId,
  slug,
  destinationName,
  userId,
  myReview,
  isEdit,
}: Omit<ReviewDialogProps, "userId"> & { userId: string; isEdit: boolean }) {
  const router = useRouter();
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(myReview?.rating ?? null);
  const [content, setContent] = useState(myReview?.content ?? "");
  const [photo, setPhoto] = useState<PhotoState>({ kind: "keep" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 미리보기용 임시 URL은 다 쓰면 해제한다 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  const previewUrl =
    photo.kind === "new"
      ? photo.previewUrl
      : photo.kind === "keep"
        ? (myReview?.photoUrl ?? null)
        : null;

  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    const error = validatePhoto(file);
    if (error) {
      setErrors((e) => ({ ...e, photo: error }));
      return;
    }
    setErrors((e) => ({ ...e, photo: undefined }));
    setPhoto({ kind: "new", file, previewUrl: URL.createObjectURL(file) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = reviewSchema.safeParse({ rating: rating ?? 0, content });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "rating" || key === "content") && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      let photoPath: string | null | undefined; // undefined = 기존 유지
      let uploadedPath: string | null = null;

      if (photo.kind === "new") {
        const ext =
          photo.file.type.split("/")[1] === "jpeg" ? "jpg" : photo.file.type.split("/")[1];
        uploadedPath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient()
          .storage.from(REVIEW_PHOTO.bucket)
          .upload(uploadedPath, photo.file, { contentType: photo.file.type, upsert: false });
        if (error) {
          setFormError("사진을 올리지 못했어요. 다시 시도해 주세요");
          return;
        }
        photoPath = uploadedPath;
      } else if (photo.kind === "remove") {
        photoPath = null;
      }

      const result = await saveReview({ destinationId, slug, ...parsed.data, photoPath });
      if (!result.ok) {
        if (uploadedPath)
          await createClient().storage.from(REVIEW_PHOTO.bucket).remove([uploadedPath]);
        if (result.reason === "unauthenticated") {
          router.push(`/login?next=${encodeURIComponent(`/destinations/${slug}`)}`);
          return;
        }
        setFormError(result.message ?? "리뷰를 저장하지 못했어요. 다시 시도해 주세요");
        return;
      }
      setOpen(false);
    });
  };

  const remove = () => {
    if (!myReview) return;
    startTransition(async () => {
      const result = await deleteReview(myReview.id, slug);
      if (result.ok) setOpen(false);
      else setFormError("리뷰를 삭제하지 못했어요. 다시 시도해 주세요");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "outline" : "default"} className="h-10 gap-1.5 rounded-md px-4">
          {isEdit && <PencilIcon aria-hidden className="size-4" />}
          {isEdit ? "내 리뷰 수정" : "리뷰 쓰기"}
        </Button>
      </DialogTrigger>
      <DialogContent
        // 767 이하: 화면 아래에 붙는 시트 형태
        className="max-h-[90dvh] overflow-y-auto max-md:top-auto max-md:bottom-0 max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="text-lg">{isEdit ? "내 리뷰 수정" : "리뷰 쓰기"}</DialogTitle>
            <DialogDescription>{destinationName} 여행은 어떠셨나요?</DialogDescription>
          </DialogHeader>

          {/* 별점: 네이티브 라디오를 써서 화살표 키 이동과 스크린리더 안내를 그대로 얻는다 */}
          <fieldset aria-describedby={errors.rating ? `${ids}-rating-error` : undefined}>
            <legend className="mb-2 text-sm font-medium">별점</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <label key={star} className="cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={star}
                    checked={rating === star}
                    onChange={() => {
                      setRating(star);
                      setErrors((e) => ({ ...e, rating: undefined }));
                    }}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{star}점</span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-11 place-items-center rounded-md text-3xl leading-none transition-colors duration-fast peer-focus-visible:shadow-focus",
                      rating !== null && star <= rating
                        ? "text-highlight"
                        : "text-input hover:text-muted-foreground",
                    )}
                  >
                    ★
                  </span>
                </label>
              ))}
            </div>
            {errors.rating && (
              <p id={`${ids}-rating-error`} role="alert" className="mt-1 text-sm text-destructive">
                {errors.rating}
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor={`${ids}-content`} className="text-sm font-medium">
              후기
            </label>
            <Textarea
              id={`${ids}-content`}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) setErrors((er) => ({ ...er, content: undefined }));
              }}
              maxLength={1000}
              rows={6}
              placeholder="좋았던 점, 다음 여행자에게 알려 주고 싶은 팁을 적어 주세요 (10자 이상)"
              aria-invalid={Boolean(errors.content) || undefined}
              aria-describedby={`${ids}-content-hint`}
              className="min-h-36 rounded-md bg-card px-4 py-3 text-base md:text-base dark:bg-card"
            />
            <div id={`${ids}-content-hint`} className="flex justify-between text-sm">
              <span role={errors.content ? "alert" : undefined} className="text-destructive">
                {errors.content}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {content.trim().length}/1000
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">사진 (선택, 1장)</span>
            {previewUrl ? (
              <div className="relative size-32 overflow-hidden rounded-md bg-muted">
                {/* 새로 고른 파일은 blob: URL이라 next/image 최적화 대상이 아니다 */}
                <Image
                  src={previewUrl}
                  alt="첨부한 사진 미리보기"
                  fill
                  sizes="128px"
                  unoptimized
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto({ kind: "remove" })}
                  aria-label="사진 빼기"
                  className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-stone-900/70 text-white hover:bg-stone-900"
                >
                  <XIcon aria-hidden className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-input text-sm text-muted-foreground hover:bg-muted has-focus-visible:shadow-focus">
                <ImagePlusIcon aria-hidden className="size-5" />
                사진 추가 · JPG, PNG, WebP 5MB 이하
                <input
                  type="file"
                  accept={REVIEW_PHOTO.types.join(",")}
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            )}
            {errors.photo && (
              <p role="alert" className="text-sm text-destructive">
                {errors.photo}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 text-destructive hover:text-destructive"
                  >
                    리뷰 삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>리뷰를 삭제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      삭제한 리뷰와 사진은 되돌릴 수 없어요.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={remove} disabled={pending}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="h-11 gap-1.5 rounded-md px-6 text-base"
            >
              {pending && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
              {pending ? "저장하는 중…" : isEdit ? "수정하기" : "등록하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
