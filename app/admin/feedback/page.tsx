"use client";

import { useEffect, useState } from "react";
import { fetchAdminFeedback } from "@/lib/api/admin";
import { AdminTopBar, ErrorBanner, LoadingBlock } from "../_components/AdminPage";

export default function AdminFeedbackPage() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminFeedback()
      .then((items) => {
        if (!cancelled) setCount(items.length);
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
        <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">Phản hồi người dùng</h1>
        {error && <ErrorBanner message={error} />}
        <div className="bg-white border border-[#ECEAE5] rounded-[16px]">
          {count === null && !error ? (
            <LoadingBlock label="Đang tải phản hồi…" />
          ) : (
            <div className="py-16 text-center text-[13px] text-[#A8A49C]">
              Chưa có phản hồi nào. Tính năng thu thập phản hồi sẽ có ở giai đoạn sau.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
