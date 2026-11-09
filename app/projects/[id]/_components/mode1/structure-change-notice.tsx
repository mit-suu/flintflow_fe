"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { getImport } from "@/lib/api/import";
import type { StructureChange } from "@/types/import";

const seenKey = (projectId: string) => `ff:structure-changes-seen:${projectId}`;
const readSeen = (projectId: string): boolean => {
  try {
    return localStorage.getItem(seenKey(projectId)) === "1";
  } catch {
    return false;
  }
};

/**
 * Business-flow §3.1.2 (D5): kết quả đọc chi tiết lệch màn đọc khung ⇒ đi theo kết quả cuối, báo **một lần** trong workspace (đóng
 * rồi thì nhớ theo dự án), không dừng hỏi lại. Không đọc được lần import (dự án không tải file) ⇒ không hiện gì.
 */
export default function StructureChangeNotice({ projectId, inline = false }: { projectId: string; /** Nằm trong nội dung trang (không phải trên ô chat) ⇒ bỏ lề ngang. */ inline?: boolean }) {
  const t = useTranslations("workspace.structureChanges");
  const [changes, setChanges] = useState<StructureChange[]>([]);

  useEffect(() => {
    if (readSeen(projectId)) return;
    let cancelled = false;
    getImport(projectId)
      .then((res) => !cancelled && setChanges(res.data?.import?.structure_changes ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!changes.length) return null;
  const nowEmpty = changes.filter((c) => c.to === "missing");
  const nowFilled = changes.filter((c) => c.to === "present");
  const other = changes.filter((c) => c.to !== "missing" && c.to !== "present");
  const names = (list: StructureChange[]) => list.map((c) => c.title).join(", ");

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(projectId), "1");
    } catch {
      // Không lưu được (chế độ riêng tư) ⇒ chỉ ẩn trong phiên này
    }
    setChanges([]);
  };

  return (
    <div role="status" className={`${inline ? "" : "mx-3 mb-2 "}flex items-start gap-3 rounded-card bg-surface-container px-3 py-2.5`}>
      <Icon name="layers" size={16} className="mt-0.5 shrink-0 text-primary" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-body text-on-surface">
        {nowEmpty.length > 0 && <p>{t("nowEmpty", { count: nowEmpty.length, names: names(nowEmpty) })}</p>}
        {nowFilled.length > 0 && <p>{t("nowFilled", { count: nowFilled.length, names: names(nowFilled) })}</p>}
        {other.length > 0 && <p>{t("other", { count: other.length, names: names(other) })}</p>}
      </div>
      <button type="button" onClick={dismiss} aria-label={t("dismiss")} className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
