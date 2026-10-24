"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/shadcn/badge";
import { Card } from "@/components/shadcn/card";
import { fetchAdminFeedback, formatDateTime, type AdminFeedbackItem } from "@/lib/api/admin";
import type { FeedbackCategory } from "@/lib/api/feedback";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner, LoadingBlock } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

/** Badge nền trắng, phân loại bằng màu viền + chữ (cùng kiểu với badge trong bảng). Nhãn ở `admin.feedback.categories`. */
const CATEGORY_CLASS: Record<FeedbackCategory, string> = {
  bug: "border-error-border text-destructive",
  suggestion: "border-primary/40 text-primary",
  other: "text-muted-foreground",
};

export default function AdminFeedbackPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  /** Lỗi tải gần nhất: giữ nguyên lỗi, dịch lúc render — đổi ngôn ngữ không phải tải lại. */
  const [error, setError] = useState<{ cause: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminFeedback()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err) => {
        if (!cancelled) setError({ cause: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader
          title={t("feedback.title")}
          description={t("feedback.description")}
        />
        {error && <ErrorBanner message={userErrorMessage(error.cause, t("feedback.loadFailed"))} />}

        <AdminScroll>
          {items === null && !error ? (
            <LoadingBlock label={t("feedback.loading")} variant="list" />
          ) : !items || items.length === 0 ? (
            <Card className="py-16">
              <p className="text-muted-foreground text-center text-body">{t("feedback.empty")}</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <Card key={item._id} className="gap-2 py-4">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 px-5 text-caption">
                  <Badge variant="outline" className={CATEGORY_CLASS[item.category]}>
                    {t(`feedback.categories.${item.category}`)}
                  </Badge>
                  <span className="text-foreground font-semibold">
                    {item.user ? item.user.name || item.user.email : t("feedback.deletedAccount")}
                  </span>
                  {item.user?.name && <span>{item.user.email}</span>}
                  <span className="ms-auto">{formatDateTime(item.createdAt, locale)}</span>
                </div>
                  <p className="px-5 text-body leading-[1.6] break-words whitespace-pre-wrap">{item.message}</p>
                </Card>
              ))}
            </div>
          )}
        </AdminScroll>
      </AdminMain>
    </>
  );
}
