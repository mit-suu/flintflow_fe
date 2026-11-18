"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Tabs from "@/components/ui/Tabs";
import type { Spine } from "@/types/spine";

interface NamesGlossaryPanelProps {
  spine: Pick<Spine, "actors" | "entities" | "screens" | "glossary">;
  /** Điền sẵn lệnh đổi tên / thêm thuật ngữ vào ô chat (bật Sửa tài liệu); bỏ trống (Viewer) ⇒ không có nút. */
  onEditByChat?: (prefill: string) => void;
  busy?: boolean;
}

type Tab = "actors" | "entities" | "screens" | "glossary";

/** Thứ tự tab; nhãn: `workspace.names.tab.<tab>`. */
const TABS: readonly Tab[] = ["actors", "entities", "screens", "glossary"];
/** Danh sách dài hơn mức này chỉ hiện chừng ấy dòng + "Xem thêm" — không cuộn lồng trong panel đã cuộn. */
const PREVIEW_ROWS = 8;

/**
 * Tên & thuật ngữ (Phases §2.3): danh sách **chỉ đọc**. Đổi tên / thêm thuật ngữ đi qua chat (business-flow nguyên tắc 6):
 * nút "Sửa qua chat" điền sẵn lệnh, AI đổi tên ở field có khoá **và** các câu nhắc tới tên đó — sửa thẳng ở bảng chỉ đổi
 * field, để lại tham chiếu gãy trong văn xuôi.
 */
export default function NamesGlossaryPanel({ spine, onEditByChat, busy = false }: NamesGlossaryPanelProps) {
  const t = useTranslations("workspace.names");
  const [tab, setTab] = useState<Tab>("actors");
  const [showAll, setShowAll] = useState(false);

  const rows =
    tab === "glossary"
      ? spine.glossary.map((g) => ({ id: g.id, value: g.term, hint: g.definition }))
      : spine[tab].map((el) => ({ id: el.id, value: el.name, hint: "" }));
  const shown = showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  const switchTab = (next: Tab) => {
    setTab(next);
    setShowAll(false);
  };

  return (
    <div role="group" className="@container flex flex-col gap-2" aria-label={t("aria")}>
      <Tabs
        label={t("tabsLabel")}
        idBase="names"
        value={tab}
        onChange={switchTab}
        layout="grid"
        className="self-stretch grid-cols-2 @min-[30rem]:grid-cols-4 [&>button]:justify-center [&>button]:px-1 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-body [&>button]:h-7"
        options={TABS.map((id) => ({
          value: id,
          label: t(`tab.${id}`),
          count: id === "glossary" ? spine.glossary.length : spine[id].length,
        }))}
      />

      <ul role="tabpanel" id="names-panel" aria-labelledby={`names-tab-${tab}`} className="flex flex-col">
        {rows.length === 0 && <li className="py-1.5 text-body text-on-surface-muted">{t("empty")}</li>}
        {shown.map((row) => (
          <li key={row.id} className="group/name -mx-2 px-2 py-1.5 rounded-control flex items-center justify-between gap-2 hover:bg-surface-container-low">
            <span className="min-w-0 flex flex-col">
              <span className="text-body text-on-surface truncate">{row.value}</span>
              {row.hint && <span className="text-caption text-on-surface-muted line-clamp-2">{row.hint}</span>}
            </span>
            {onEditByChat && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onEditByChat(t("renameByChatPrefill", { name: row.value }))}
                aria-label={t("editByChatAria", { name: row.value })}
                className="shrink-0 text-caption font-semibold text-primary hover:underline cursor-pointer opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              >
                {t("editByChat")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {rows.length > PREVIEW_ROWS && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start text-body font-semibold text-primary hover:underline cursor-pointer">
          {showAll ? t("collapse") : t("showMore", { count: rows.length - PREVIEW_ROWS })}
        </button>
      )}

      {tab === "glossary" && onEditByChat && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onEditByChat(t("addTermByChatPrefill"))}
          className="self-start text-body font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
        >
          {t("addTermByChat")}
        </button>
      )}
    </div>
  );
}
