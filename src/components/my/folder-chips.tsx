"use client";

import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createFolder, deleteFolder, renameFolder, type ActionResult } from "@/actions/likes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { LikeFolder } from "@/lib/data/likes";
import { cn } from "@/lib/utils";

type FolderChipsProps = {
  folders: LikeFolder[];
  activeFolderId: string | null;
  totalCount: number;
};

const chipClass =
  "my-0.5 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-fast";

/**
 * 찜 폴더 칩 필터 (명세 4.4: 폴더 칩 필터) + 폴더 관리(사용자 확정: 나의 여행에서 관리)
 * - 칩은 링크(?folder=)라서 선택 상태가 URL에 남는다
 * - 선택한 폴더 칩 옆 ⋯ 메뉴: 이름 바꾸기 / 삭제
 */
export function FolderChips({ folders, activeFolderId, totalCount }: FolderChipsProps) {
  const [dialog, setDialog] = useState<
    | { type: "create" }
    | { type: "rename"; folder: LikeFolder }
    | { type: "delete"; folder: LikeFolder }
    | null
  >(null);
  const active = folders.find((f) => f.id === activeFolderId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="찜 폴더" className="contents">
        <Chip href="/my?tab=likes" selected={!active}>
          전체 <span className="text-xs opacity-70">{totalCount}</span>
        </Chip>
        {folders.map((f) => (
          <Chip key={f.id} href={`/my?tab=likes&folder=${f.id}`} selected={f.id === active?.id}>
            {f.name} <span className="text-xs opacity-70">{f.count}</span>
          </Chip>
        ))}
      </nav>

      {active && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${active.name} 폴더 관리`}
            className="grid size-10 place-items-center rounded-full hover:bg-muted"
          >
            <MoreHorizontalIcon aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setDialog({ type: "rename", folder: active })}>
              이름 바꾸기
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDialog({ type: "delete", folder: active })}
            >
              폴더 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <button
        type="button"
        onClick={() => setDialog({ type: "create" })}
        className={cn(chipClass, "border-dashed border-input text-primary hover:bg-accent")}
      >
        <PlusIcon aria-hidden className="size-4" />새 폴더
      </button>

      <FolderNameDialog
        open={dialog?.type === "create" || dialog?.type === "rename"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.type === "rename" ? "폴더 이름 바꾸기" : "새 폴더"}
        initialName={dialog?.type === "rename" ? dialog.folder.name : ""}
        submitLabel={dialog?.type === "rename" ? "바꾸기" : "만들기"}
        onSubmit={(name) =>
          dialog?.type === "rename" ? renameFolder(dialog.folder.id, name) : createFolder(name)
        }
      />

      <DeleteFolderDialog
        folder={dialog?.type === "delete" ? dialog.folder : null}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  );
}

function Chip({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "page" : undefined}
      className={cn(
        chipClass,
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-input bg-card text-foreground hover:border-stone-700 hover:bg-muted dark:hover:border-stone-300",
      )}
    >
      {children}
    </Link>
  );
}

function FolderNameDialog({
  open,
  onOpenChange,
  title,
  initialName,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form
          // key: 다이얼로그를 열 때마다 입력값을 초기화
          key={`${open}-${initialName}`}
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "");
            startTransition(async () => {
              const result = await onSubmit(name);
              if (result.ok) {
                setError(null);
                onOpenChange(false);
              } else if (result.reason === "unauthenticated") {
                router.push("/login?next=/my");
              } else {
                setError(result.message ?? "저장하지 못했어요. 다시 시도해 주세요");
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>20자 이내로 지어 주세요. 예: 가을 후보</DialogDescription>
          </DialogHeader>
          <Input
            name="name"
            defaultValue={initialName}
            maxLength={20}
            aria-label="폴더 이름"
            aria-invalid={Boolean(error) || undefined}
            autoFocus
            className="h-12 text-base"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 rounded-md px-5">
              {pending ? "저장 중…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFolderDialog({
  folder,
  onOpenChange,
}: {
  folder: LikeFolder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={folder !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>‘{folder?.name}’ 폴더를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            폴더 안의 찜은 지워지지 않고 ‘전체’에 남아요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault(); // 저장이 끝난 뒤에 닫는다
              if (!folder) return;
              startTransition(async () => {
                await deleteFolder(folder.id);
                onOpenChange(false);
                router.replace("/my?tab=likes", { scroll: false });
              });
            }}
          >
            {pending ? "삭제 중…" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
