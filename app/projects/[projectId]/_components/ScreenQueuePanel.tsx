"use client";

import { useTranslations } from "next-intl";
import type { Screen, ScreenDetailStatus, Spine } from "@/types/spine";

interface ScreenQueuePanelProps {
  spine: Pick<Spine, "screens" | "progress">;
  onMarkPlaceholder: (screenId: string) => void;
  busy?: boolean;
}

/** Nhãn ở `workspace.screenQueue.status.<status>`. */
const STATUS_STYLE: Record<ScreenDetailStatus, string> = {
  pending: "bg-[#F0EEEA] text-[#6B6862]",
  in_progress: "bg-[#F4F3FE] text-[#4F46E5]",
  signed_off: "bg-[#E9F7EE] text-[#1F7A45]",
  placeholder: "bg-[#FBF4E4] text-[#8A6D1F]",
};

const byQueue = (a: Screen, b: Screen) =>
  (a.queue_order ?? Number.MAX_SAFE_INTEGER) - (b.queue_order ?? Number.MAX_SAFE_INTEGER) || (a.id < b.id ? -1 : 1);

/** Hàng đợi vòng S-5 (Phases §6.2): màn pending đi tiếp; "Để lại" đánh dấu placeholder (cắt theo độ sâu). */
export default function ScreenQueuePanel({ spine, onMarkPlaceholder, busy = false }: ScreenQueuePanelProps) {
  const t = useTranslations("workspace.screenQueue");
  const screens = [...spine.screens].sort(byQueue);
  if (screens.length === 0) {
    return <div className="text-[11.5px] text-[#A8A49C] italic px-3 py-2">{t("empty")}</div>;
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label={t("aria")}>
      {screens.map((screen) => {
        const isCursor = spine.progress.screen_cursor === screen.id;
        return (
          <li key={screen.id} className={`flex items-center gap-2 px-3 py-2 rounded-[10px] border ${isCursor ? "border-[#4F46E5] bg-[#F4F3FE]" : "border-[#ECEAE5] bg-white"}`}>
            <span className="font-mono text-[10.5px] text-[#8A867E]">{screen.id}</span>
            <span className="text-[12px] font-semibold text-[#191817] flex-1 truncate">{screen.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[screen.detail_status]}`}>
              {t(`status.${screen.detail_status}`)}
            </span>
            {screen.detail_status === "pending" && !isCursor && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onMarkPlaceholder(screen.id)}
                className="text-[10.5px] font-bold text-[#8A6D1F] hover:underline disabled:opacity-50 cursor-pointer"
              >
                {t("markPlaceholder")}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
