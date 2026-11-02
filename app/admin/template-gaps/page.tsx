"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/shadcn/card";
import { fetchTemplateGaps, type TemplateGapRow } from "@/lib/api/admin";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, AdminScroll, ErrorBanner, LoadingBlock } from "../_components/AdminPage";
import { userErrorMessage } from "@/lib/api/error-messages";

/**
 * FLF-278 trên FLF-335/336: heading của mẫu bắt buộc mà FlintFlow không có mục tương ứng (thành mục riêng) và còn trống ở
 * bao nhiêu dự án — đầu vào để nhóm quyết định mở rộng Spine (`flintflow_be/docs/template-gap-proposal.md`). Chỉ đọc.
 */
export default function AdminTemplateGapsPage() {
  const t = useTranslations("admin");
  const [data, setData] = useState<{ projects: number; rows: TemplateGapRow[] } | null>(null);
  /** Lỗi tải gần nhất: dịch lúc render — đổi ngôn ngữ không phải tải lại. */
  const [error, setError] = useState<{ cause: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTemplateGaps()
      .then((next) => {
        if (!cancelled) setData(next);
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
        <AdminPageHeader title={t("templateGaps.title")} description={t("templateGaps.description")} />
        {error && <ErrorBanner message={userErrorMessage(error.cause, t("templateGaps.loadFailed"))} />}
        <AdminScroll>
          {data === null && !error ? (
            <LoadingBlock label={t("templateGaps.loading")} variant="list" />
          ) : !data || data.rows.length === 0 ? (
            <Card className="py-16">
              <p className="text-muted-foreground text-center text-body">{t("templateGaps.empty")}</p>
            </Card>
          ) : (
            <Card className="py-0 overflow-hidden">
              <p className="text-muted-foreground px-5 pt-4 text-caption">{t("templateGaps.basis", { projects: data.projects })}</p>
              <table className="w-full text-body">
                <thead>
                  <tr className="text-muted-foreground text-caption text-left">
                    <th className="px-5 py-2 font-semibold">{t("templateGaps.colTitle")}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t("templateGaps.colProjects")}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t("templateGaps.colEmpty")}</th>
                    <th className="px-5 py-2 font-semibold">{t("templateGaps.colSuggested")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="px-5 py-2.5">{row.samples.join(" · ")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.projects}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.empty}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{row.suggested_destination ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </AdminScroll>
      </AdminMain>
    </>
  );
}
