"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import ResolveQueueCard from "./ResolveQueueCard";
import type { ResolveQueueController } from "./useResolveQueue";

interface ResolveQueueDockProps {
  controller: ResolveQueueController;
  onShowSection: (sectionId: string) => void;
}

const BAR = "mx-3 mb-2 bg-primary-soft rounded-control px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body text-on-surface";

/**
 * "N việc chờ bạn quyết · Giải quyết lần lượt" ở vùng ô nhập (slot `inputNotice` của ChatPane). Bấm mở thẻ một việc mỗi
 * lần. Ẩn hẳn khi AI hỏi / thẻ duyệt mở (controller.visible = false), thu một dòng và khoá khi AI đang chạy.
 */
export default function ResolveQueueDock({ controller: c, onShowSection }: ResolveQueueDockProps) {
  const t = useTranslations("workspace.resolveQueue");
  if (!c.visible) return null;

  const cardOpen = (c.phase === "queue" || c.phase === "single") && c.current !== null;
  // Chế độ 1 (FLF-445): dải nói theo số cờ ("N cờ nên xem"), thẻ là một nhóm cờ
  const pendingText = c.mode1 ? t("mode1.dock.pending", { count: c.flagCount }) : t("dock.pending", { count: c.total });

  if (c.locked) {
    return (
      <p role="status" className={BAR}>
        <span className="font-bold">{pendingText}</span>
        <span className="text-on-surface-variant">{t("dock.locked")}</span>
      </p>
    );
  }

  if (c.phase === "afterSingle") {
    return (
      <div className={BAR}>
        <span className="font-bold flex-1 min-w-0">{t("afterSingle.text", { count: c.total })}</span>
        <Button size="sm" onClick={c.continueQueue}>
          {t("afterSingle.continue")}
        </Button>
        <Button size="sm" variant="ghost" onClick={c.collapse}>
          {t("afterSingle.later")}
        </Button>
      </div>
    );
  }

  if (cardOpen) return <ResolveQueueCard key={c.current?.key} controller={c} onShowSection={onShowSection} />;

  // Mọi việc còn lại đều đã "Để sau" ⇒ dải đổi lời, "Xem lại" mở lại từ đầu
  const allDeferred = c.activeCount === 0;
  return (
    <div className={BAR}>
      <span className="font-bold flex-1 min-w-0">{allDeferred ? t("dock.deferred", { count: c.total }) : pendingText}</span>
      <Button size="sm" onClick={allDeferred ? c.reviewLater : c.open}>
        {t(allDeferred ? "dock.review" : "dock.start")}
      </Button>
    </div>
  );
}
