"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  fetchAdminUsers,
  type AdminUser,
  type AdminUserRole,
  type PageMeta,
} from "@/lib/api/admin";
import { DataTable, DataTableToolbar } from "@/components/shadcn/data-table";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { singleFilterValue, useServerDataTable } from "@/lib/hooks/use-server-data-table";
import AdminHeader from "../_components/AdminHeader";
import { AdminMain, AdminPageHeader, ErrorBanner, LoadingBlock } from "../_components/AdminPage";
import { userRoleOptions, userStatusOptions, usersColumns } from "./_components/UsersColumns";
import { userErrorMessage } from "@/lib/api/error-messages";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const columns = useMemo(() => usersColumns(t, locale), [t, locale]);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  /** Lỗi tải gần nhất: giữ nguyên lỗi, dịch lúc render — đổi ngôn ngữ không phải tải lại. */
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  /** Bộ tham số đã tải xong (kể cả khi lỗi). Khác bộ đang cần ⇒ đang tải — không cần state `loading` riêng,
   *  vốn phải set ngay trong effect (eslint `react-hooks/set-state-in-effect` chặn). */
  const [loadedParams, setLoadedParams] = useState<object | null>(null);

  const { table, pagination, globalFilter, columnFilters } = useServerDataTable({
    data: items,
    columns,
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
        if (!cancelled) setError({ cause: err });
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
          title={t("users.title")}
          description={
            meta ? t("users.descriptionCount", { count: meta.total }) : t("users.descriptionFallback")
          }
        />

        {error && <ErrorBanner message={userErrorMessage(error.cause, t("users.loadFailed"))} onClose={() => setError(null)} />}

        {loading && items.length === 0 ? (
          <LoadingBlock label={t("users.loading")} />
        ) : (
          <DataTable
            table={table}
            columns={columns}
            emptyMessage={t("users.empty")}
            className={loading ? "opacity-60 transition-opacity" : undefined}
            toolbar={
              <DataTableToolbar
                table={table}
                searchPlaceholder={t("users.searchPlaceholder")}
                filters={[
                  { columnId: "role", title: t("common.role"), options: userRoleOptions(t) },
                  { columnId: "isActive", title: t("common.status"), options: userStatusOptions(t) },
                ]}
              />
            }
          />
        )}
      </AdminMain>
    </>
  );
}
