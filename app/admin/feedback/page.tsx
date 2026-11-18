"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/shadcn/badge";
import { PagedDataList, SearchInput } from "@/components/ui";
import { fetchAdminFeedback, formatDateTime, type AdminFeedbackItem } from "@/lib/api/admin";
import type { FeedbackCategory } from "@/lib/api/feedback";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { usePagedList } from "@/lib/hooks/use-paged-list";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

/** Badge nền trắng, phân loại bằng màu viền + chữ (cùng kiểu với badge trong bảng). Nhãn ở `admin.feedback.categories`. */
const CATEGORY_CLASS: Record<FeedbackCategory, string> = {
  bug: "border-error-border text-destructive",
  suggestion: "border-primary/40 text-primary",
  other: "text-muted-foreground",
};

const PAGE_SIZE = 20;

/**
 * Góp ý người dùng (UC-12) — thanh số trang (FLF-404): phân trang và tìm (không dấu, theo nội dung / email / tên người gửi)
 * chạy ở BE. Ô tìm nằm ngoài vùng cuộn nên luôn thấy được.
 */
export default function AdminFeedbackPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  // Gõ liên tục chỉ gọi BE một lần sau khi dừng gõ
  const q = useDebounce(query.trim(), 300);

  const list = usePagedList<AdminFeedbackItem>({
    key: q,
    fetchPage: (page) => fetchAdminFeedback({ page, limit: PAGE_SIZE, q: q || undefined }),
  });

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader title={t("feedback.title")} description={t("feedback.description")} />
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            label={t("feedback.searchLabel")}
            placeholder={t("feedback.searchPlaceholder")}
            className="sm:w-[360px]"
          />
          {q !== "" && !list.loading && (
            <span className="text-muted-foreground text-body tabular-nums" aria-live="polite">
              {t("feedback.results", { count: list.total })}
            </span>
          )}
        </div>
        {list.error ? <ErrorBanner message={userErrorMessage(list.error, t("feedback.loadFailed"))} /> : null}

        <AdminScroll>
          <PagedDataList
            list={list}
            getKey={(item) => item._id}
            loadingLabel={t("feedback.loading")}
            rowClassName="flex flex-col gap-2"
            empty={
              !list.error && (
                <p className="bg-surface-container-low text-muted-foreground rounded-card px-4 py-16 text-center text-body">
                  {q === "" ? t("feedback.empty") : t("feedback.noMatch", { query: q })}
                </p>
              )
            }
            renderItem={(item) => (
              <>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-caption">
                  <Badge variant="outline" className={CATEGORY_CLASS[item.category]}>
                    {t(`feedback.categories.${item.category}`)}
                  </Badge>
                  <span className="text-foreground font-semibold">
                    {item.user ? item.user.name || item.user.email : t("feedback.deletedAccount")}
                  </span>
                  {item.user?.name && <span>{item.user.email}</span>}
                  <span className="ms-auto">{formatDateTime(item.createdAt, locale)}</span>
                </div>
                <p className="text-body leading-[1.6] break-words whitespace-pre-wrap">{item.message}</p>
              </>
            )}
          />
        </AdminScroll>
      </AdminMain>
    </>
  );
}
