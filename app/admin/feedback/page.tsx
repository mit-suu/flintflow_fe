"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/shadcn/badge";
import { Card } from "@/components/shadcn/card";
import { fetchAdminFeedback, formatDateTime, type AdminFeedbackItem } from "@/lib/api/admin";
import type { FeedbackCategory } from "@/lib/api/feedback";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner, LoadingBlock } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

/** Badge nền trắng, phân loại bằng màu viền + chữ (cùng kiểu với badge trong bảng). */
const CATEGORY: Record<FeedbackCategory, { label: string; className: string }> = {
  bug: { label: "Báo lỗi", className: "border-error-border text-destructive" },
  suggestion: { label: "Đề xuất", className: "border-primary/40 text-primary" },
  other: { label: "Khác", className: "text-muted-foreground" },
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminFeedback()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err) => {
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải phản hồi"));
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
          title="Phản hồi người dùng"
          description="Báo lỗi và đề xuất gửi từ trong sản phẩm, mới nhất trước."
        />
        {error && <ErrorBanner message={error} />}

        <AdminScroll>
          {items === null && !error ? (
            <LoadingBlock label="Đang tải phản hồi…" variant="list" />
          ) : !items || items.length === 0 ? (
            <Card className="py-16">
              <p className="text-muted-foreground text-center text-body">Chưa có phản hồi nào.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <Card key={item._id} className="gap-2 py-4">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 px-5 text-caption">
                  <Badge variant="outline" className={CATEGORY[item.category].className}>
                    {CATEGORY[item.category].label}
                  </Badge>
                  <span className="text-foreground font-semibold">
                    {item.user ? item.user.name || item.user.email : "Tài khoản đã xoá"}
                  </span>
                  {item.user?.name && <span>{item.user.email}</span>}
                  <span className="ms-auto">{formatDateTime(item.createdAt)}</span>
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
