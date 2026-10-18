"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminUsers,
  formatNumber,
  type AdminUser,
  type AdminUserRole,
  type PageMeta,
} from "@/lib/api/admin";
import { DataTable, DataTableToolbar } from "@/components/shadcn/data-table";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { singleFilterValue, useServerDataTable } from "@/lib/hooks/use-server-data-table";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, ErrorBanner, LoadingBlock } from "../_components/AdminPage";
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS, usersColumns } from "./_components/UsersColumns";
import { userErrorMessage } from "@/lib/api/error-messages";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bộ tham số đã tải xong (kể cả khi lỗi). Khác bộ đang cần ⇒ đang tải — không cần state `loading` riêng,
   *  vốn phải set ngay trong effect (eslint `react-hooks/set-state-in-effect` chặn). */
  const [loadedParams, setLoadedParams] = useState<object | null>(null);

  const { table, pagination, globalFilter, columnFilters } = useServerDataTable({
    data: items,
    columns: usersColumns,
    pageCount: meta?.totalPages ?? -1,
    pageSize: PAGE_SIZE,
  });

  const search = useDebounce(globalFilter);
  const role = singleFilterValue(columnFilters, "role") as AdminUserRole | undefined;
  const activeFilter = singleFilterValue(columnFilters, "isActive");

  const params = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      q: search.trim() || undefined,
      role,
      isActive: activeFilter === undefined ? undefined : activeFilter === "true",
    }),
    [pagination.pageIndex, pagination.pageSize, search, role, activeFilter]
  );

  const loading = loadedParams !== params;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchAdminUsers(params);
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(userErrorMessage(err, "Không thể tải danh sách người dùng"));
      } finally {
        if (!cancelled) setLoadedParams(params);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <>
      <AdminHeader />
      <AdminMain>
        <AdminPageHeader
          title="Người dùng"
          description={
            meta ? `${formatNumber(meta.total)} tài khoản trong hệ thống.` : "Tài khoản trong hệ thống."
          }
        />

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {loading && items.length === 0 ? (
          <LoadingBlock label="Đang tải người dùng…" />
        ) : (
          <DataTable
            table={table}
            columns={usersColumns}
            emptyMessage="Không có người dùng phù hợp"
            className={loading ? "opacity-60 transition-opacity" : undefined}
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder="Tìm theo email hoặc tên"
                filters={[
                  { columnId: "role", title: "Vai trò", options: USER_ROLE_OPTIONS },
                  { columnId: "isActive", title: "Trạng thái", options: USER_STATUS_OPTIONS },
                ]}
              />
            }
          />
        )}
      </AdminMain>
    </>
  );
}
