"use client";

import { useEffect, useState } from "react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { fetchAdminFeedback, formatDateTime, type AdminFeedbackItem } from "@/lib/api/admin";
import type { FeedbackCategory } from "@/lib/api/feedback";
import { AdminTopBar, ErrorBanner, LoadingBlock } from "../_components/AdminPage";

const CATEGORY: Record<FeedbackCategory, { label: string; tone: BadgeTone }> = {
  bug: { label: "Báo lỗi", tone: "danger" },
  suggestion: { label: "Đề xuất", tone: "primary" },
  other: { label: "Khác", tone: "neutral" },
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải phản hồi");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AdminTopBar trail={["Phản hồi"]} />
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 sm:p-8">
        <h1 className="text-[24px] font-extrabold text-on-surface tracking-tight">Phản hồi người dùng</h1>
        {error && <ErrorBanner message={error} />}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-[16px]">
          {items === null && !error ? (
            <LoadingBlock label="Đang tải phản hồi…" />
          ) : !items || items.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-on-surface-subtle">Chưa có phản hồi nào.</div>
          ) : (
            <ul className="divide-y divide-outline-subtle">
              {items.map((item) => (
                <li key={item._id} className="flex flex-col gap-1.5 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-on-surface-muted">
                    <Badge tone={CATEGORY[item.category].tone}>{CATEGORY[item.category].label}</Badge>
                    <span className="font-semibold text-on-surface-dark">
                      {item.user ? item.user.name || item.user.email : "Tài khoản đã xoá"}
                    </span>
                    {item.user?.name && <span>{item.user.email}</span>}
                    <span className="ml-auto">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="text-[13px] text-on-surface leading-[1.6] whitespace-pre-wrap break-words">{item.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
