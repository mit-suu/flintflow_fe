"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminOrgs,
  formatNumber,
  type AdjustOrgCreditsResult,
  type AdminOrg,
  type AdminOrgPlan,
  type PageMeta,
} from "@/lib/api/admin";
import { DataTable, DataTableToolbar } from "@/components/shadcn/data-table";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { singleFilterValue, useServerDataTable } from "@/lib/hooks/use-server-data-table";
import AdminHeader from "../_components/AdminHeader";
import {
  AdminMain,
  AdminPageHeader,
  ErrorBanner,
  LoadingBlock,
  SuccessBanner,
} from "../_components/AdminPage";
import AdjustCreditsDialog from "./_components/AdjustCreditsDialog";
import { ORG_PLAN_OPTIONS, orgsColumns } from "./_components/OrgsColumns";
import { userErrorMessage } from "@/lib/api/error-messages";

const PAGE_SIZE = 20;

/** UC-90 — danh sách tổ chức; mở một org để điều chỉnh credit (UC-68). */
export default function AdminOrgsPage() {
  const [items, setItems] = useState<AdminOrg[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bộ tham số đã tải xong (kể cả khi lỗi). Khác bộ đang cần ⇒ đang tải — không cần state `loading` riêng,
   *  vốn phải set ngay trong effect (eslint `react-hooks/set-state-in-effect` chặn). */
  const [loadedParams, setLoadedParams] = useState<object | null>(null);
  const [adjusting, setAdjusting] = useState<AdminOrg | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      orgsColumns((org) => {
        setNotice(null);
        setAdjusting(org);
      }),
    []
  );

  const { table, pagination, globalFilter, columnFilters } = useServerDataTable({
    data: items,
    columns,
    pageCount: meta?.totalPages ?? -1,
    pageSize: PAGE_SIZE,
  });

  const search = useDebounce(globalFilter);
  const plan = singleFilterValue(columnFilters, "plan") as AdminOrgPlan | undefined;

  const params = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      q: search.trim() || undefined,
      plan,
    }),
    [pagination.pageIndex, pagination.pageSize, search, plan]
  );

  const loading = loadedParams !== params;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchAdminOrgs(params);
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải danh sách tổ chức"));
      } finally {
        if (!cancelled) setLoadedParams(params);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleAdjusted = (result: AdjustOrgCreditsResult) => {
    setItems((prev) =>
      prev.map((o) =>
        o.id === result.organizationId
          ? {
              ...o,
              wallet: { balance: result.balance, reserved: result.reserved, available: result.balance - result.reserved },
            }
          : o
      )
    );
    const sign = result.amount > 0 ? "+" : "";
    setNotice(
      `${sign}${formatNumber(result.amount)} credit cho ${result.organizationName}. Số dư mới: ${formatNumber(result.balance)}.`
    );
  };

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader
          title="Tổ chức"
          description={
            meta ? `${formatNumber(meta.total)} tổ chức, kèm ví credit của từng tổ chức.` : "Tổ chức và ví credit."
          }
        />

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} onClose={() => setNotice(null)} />}

        {loading && items.length === 0 ? (
          <LoadingBlock label="Đang tải tổ chức…" />
        ) : (
          <DataTable
            table={table}
            columns={columns}
            emptyMessage="Không có tổ chức phù hợp"
            className={loading ? "opacity-60 transition-opacity" : undefined}
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder="Tìm theo tên hoặc email người tạo"
                filters={[{ columnId: "plan", title: "Gói", options: ORG_PLAN_OPTIONS }]}
              />
            }
          />
        )}
      </AdminMain>

      <AdjustCreditsDialog org={adjusting} onClose={() => setAdjusting(null)} onAdjusted={handleAdjusted} />
    </>
  );
}
