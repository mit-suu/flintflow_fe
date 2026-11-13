"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PagedDataList } from "@/components/ui";
import { fetchTemplateGaps, type TemplateGapRow } from "@/lib/api/admin";
import { usePagedList } from "@/lib/hooks/use-paged-list";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";
import { sectionLabel } from "@/lib/constants/fpt-sections";

const PAGE_SIZE = 20;

/** Cột từ `md`: tiêu đề | số dự án gặp | còn trống | gợi ý đích. Dưới `md` các ô xếp dưới tiêu đề. */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_96px_96px_minmax(0,0.8fr)] md:items-center md:gap-4";

/**
 * FLF-278 trên FLF-335/336: heading của mẫu bắt buộc mà FlintFlow không có mục tương ứng (thành mục riêng) và còn trống ở
 * bao nhiêu dự án — đầu vào để nhóm quyết định mở rộng Spine (`flintflow_be/docs/template-gap-proposal.md`). Chỉ đọc.
 * Thanh số trang (FLF-404): BE gom toàn bộ rồi cắt trang, không còn cắt cứng 100 dòng.
 */
export default function AdminTemplateGapsPage() {
  const t = useTranslations("admin");
  /** Số dự án làm cơ sở thống kê — của toàn bộ, không theo trang. */
  const [projects, setProjects] = useState<number | null>(null);

  const list = usePagedList<TemplateGapRow>({
    key: "gaps",
    fetchPage: async (page) => {
      const res = await fetchTemplateGaps(page, PAGE_SIZE);
      setProjects(res.projects);
      return res;
    },
  });

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader title={t("templateGaps.title")} description={t("templateGaps.description")} />
        {list.error ? <ErrorBanner message={userErrorMessage(list.error, t("templateGaps.loadFailed"))} /> : null}
        <AdminScroll>
          {projects !== null && list.total > 0 && (
            <p className="text-muted-foreground shrink-0 text-caption">{t("templateGaps.basis", { projects })}</p>
          )}
          <PagedDataList
            list={list}
            getKey={(row) => row.key}
            loadingLabel={t("templateGaps.loading")}
            rowClassName={`flex flex-col gap-1 text-body ${ROW_GRID}`}
            empty={
              !list.error && (
                <p className="bg-surface-container-low text-muted-foreground rounded-card px-4 py-16 text-center text-body">{t("templateGaps.empty")}</p>
              )
            }
            // Tiêu đề cột chỉ có khi các ô thẳng cột (từ `md`)
            header={
              <div aria-hidden className={`hidden ${ROW_GRID} text-muted-foreground px-3 pt-1.5 pb-2 text-caption font-semibold`}>
                <span>{t("templateGaps.colTitle")}</span>
                <span className="text-right">{t("templateGaps.colProjects")}</span>
                <span className="text-right">{t("templateGaps.colEmpty")}</span>
                <span>{t("templateGaps.colSuggested")}</span>
              </div>
            }
            renderItem={(row) => (
              <>
                <span className="min-w-0 break-words">{row.samples.join(" · ")}</span>
                <span className="text-muted-foreground tabular-nums md:text-right md:text-foreground">
                  <span className="md:hidden">{t("templateGaps.colProjects")}: </span>
                  {row.projects}
                </span>
                <span className="text-muted-foreground tabular-nums md:text-right md:text-foreground">
                  <span className="md:hidden">{t("templateGaps.colEmpty")}: </span>
                  {row.empty}
                </span>
                <span className="text-muted-foreground min-w-0">{row.suggested_destination ? sectionLabel(row.suggested_destination, "vi") : "-"}</span>
              </>
            )}
          />
        </AdminScroll>
      </AdminMain>
    </>
  );
}
