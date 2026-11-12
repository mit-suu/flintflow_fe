"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import {
  Button,
  CountBadge,
  DropdownMenu,
  EmptyState,
  FilterSelect,
  Icon,
  IconButton,
  InfiniteDataList,
  Modal,
  PAGE_GUTTER,
  SearchInput,
  STICKY_BLEED,
  STICKY_FADE,
} from "@/components/ui";
import { fetchOrganization } from "@/lib/api/orgs";
import { deleteOrgTemplate, listOrgTemplatesPage, type OrgTemplateSort } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { OrgRole } from "@/types/organization";

/** Mẫu chờ xác nhận xoá — giữ tên để hộp thoại nói rõ đang xoá cái gì. */
type PendingDelete = { id: string; name: string } | null;

const SORTS: readonly OrgTemplateSort[] = ["uses", "recent", "name"];
const PAGE_SIZE = 20;

/** Cột của dòng từ `md`: tên | cấu trúc | lượt dùng | ngày lưu | menu. Dưới `md` các ô xếp dưới tên. */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_200px_120px_120px_32px] md:items-center md:gap-4";

/**
 * Thư viện mẫu của tổ chức (FLF-278): mẫu SRS đã lưu từ dự án theo mẫu khách — file mẫu + mapping heading đã xác nhận,
 * dự án sau chọn lại ở ô SRS khi tạo dự án. Mọi thành viên xem; Lead + Analyst xoá — BE kiểm lại bằng `requireRole`.
 *
 * Bố cục theo trang Thành viên: tiêu đề + số đếm, danh sách dòng trên một mảng nền (không viền), thao tác trong menu ⋮,
 * xác nhận xoá trong hộp thoại. Thanh tìm / sắp xếp dính ở đầu vùng cuộn. Danh sách **tải dần khi cuộn**
 * (`useInfiniteList` + `InfiniteDataList`): tìm (không phân biệt dấu) và sắp xếp chạy ở BE, vì lọc trên mấy trang đã tải sẽ ra kết quả sai.
 * Đây là trang mẫu cho các danh sách dài khác (Thông báo, lịch sử Thanh toán, Admin Feedback…).
 */
export default function OrgLibraryPage() {
  const t = useTranslations("app.org.library");
  const tc = useTranslations("app.common");
  const format = useFormatter();
  // Như trang Thành viên: tổ chức đang mở đọc lúc render (token-store chỉ có ở trình duyệt, trang là client)
  const orgId = getActiveOrgId();
  /** Vùng cuộn của trang — làm gốc cho việc dò "đã cuộn gần cuối". State (không phải ref) để đọc được lúc render. */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<OrgTemplateSort>("uses");
  // Gõ liên tục chỉ gọi BE một lần sau khi dừng gõ
  const q = useDebounce(query.trim(), 300);

  const list = useInfiniteList({
    key: `${orgId}|${q}|${sort}`,
    enabled: orgId !== null,
    root: scrollEl,
    fetchPage: (page) => listOrgTemplatesPage(orgId!, { page, limit: PAGE_SIZE, q: q || undefined, sort }),
  });

  useEffect(() => {
    let cancelled = false;
    if (!orgId) return;
    fetchOrganization(orgId)
      .then((detail) => !cancelled && setRole(detail.role))
      .catch((err: unknown) => !cancelled && setRoleError(userErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const canEdit = role === "lead" || role === "analyst";
  /** Tổ chức thật sự chưa có mẫu nào (không phải "không khớp từ khoá"). */
  const orgEmpty = !list.loading && !list.error && q === "" && list.total === 0;
  const listError = list.error ? userErrorMessage(list.error) : roleError;

  // Đang gửi thì không đóng được — đóng giữa chừng sẽ mất lỗi BE trả về (như hộp thoại đổi tên ở trang Thành viên)
  const closeDelete = () => {
    if (busy) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!orgId || !pendingDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteOrgTemplate(orgId, pendingDelete.id);
      setPendingDelete(null);
      // Tải lại từ trang 1: xoá một dòng làm lệch ranh giới các trang đã tải
      list.reload();
    } catch (err) {
      setDeleteError(userErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />
      {/* AppShell khoá chiều cao ⇒ trang tự có vùng cuộn. Không đặt padding trên ở vùng cuộn: `sticky top-0` tính từ mép
          trong của padding nên thanh tìm sẽ treo lơ lửng, lộ dòng cuộn qua phía trên — đệm trên nằm ở khối bên trong. */}
      <div ref={setScrollEl} className={`flex-1 overflow-y-auto overflow-x-hidden pb-scroll-end bg-surface-container-lowest ${PAGE_GUTTER}`}>
        <div className="w-full max-w-[1200px] mx-auto pt-6 sm:pt-8 flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>
              {/* Số đếm là tổng của tổ chức — đang tìm thì số kết quả nằm ở thanh tìm */}
              {q === "" && list.total > 0 && <CountBadge count={list.total} />}
            </div>
            <p className="text-body text-on-surface-muted leading-[1.6] max-w-[720px]">{t("intro")}</p>
            {role !== null && !canEdit && (
              <p className="self-start inline-flex items-center gap-2 rounded-control bg-surface-container-low px-3 py-2 text-body text-on-surface-variant">
                <Icon name="info" size={15} className="shrink-0 text-on-surface-muted" />
                {t("readOnly")}
              </p>
            )}
          </header>

          {listError && (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {listError}
            </p>
          )}

          {orgEmpty ? (
            // Chưa có mẫu: nói luôn mẫu được tạo ở đâu, vì trang này không có nút thêm
            <EmptyState icon="layers" title={t("templates.empty")} description={t("templates.help")} className="rounded-card bg-surface-container-low !py-12" />
          ) : (
            <section aria-label={t("title")} className="flex flex-col gap-3">
              {/* Thanh tìm + sắp xếp dính ở đầu vùng cuộn: danh sách dài cuộn qua bên dưới, thanh không bị cuộn mất.
                  z trên nút ⋮ của dòng; -mt-3 bù đệm trên để lúc chưa dính khoảng cách với đoạn giới thiệu không đổi. */}
              <div className={`sticky top-0 z-30 -mt-3 py-3 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center gap-2 ${STICKY_BLEED} ${STICKY_FADE}`}>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  label={t("templates.searchLabel")}
                  placeholder={t("templates.searchPlaceholder")}
                  className="sm:w-[320px]"
                />
                {q !== "" && !list.loading && (
                  <span className="text-body text-on-surface-muted tabular-nums" aria-live="polite">
                    {t("templates.results", { count: list.total })}
                  </span>
                )}
                <FilterSelect
                  label={t("templates.sortLabel")}
                  value={sort}
                  onChange={setSort}
                  options={SORTS.map((value) => ({ value, label: t(`templates.sort.${value}`) }))}
                  className="sm:ml-auto self-start"
                />
              </div>

              <InfiniteDataList
                list={list}
                getKey={(tpl) => tpl.id}
                loadingLabel={t("loading")}
                rowClassName={`relative flex flex-col gap-2 ${ROW_GRID}`}
                empty={
                  q !== "" && (
                    <p className="rounded-card bg-surface-container-low px-4 py-8 text-center text-body text-on-surface-muted">
                      {t("templates.noMatch", { query: q })}
                    </p>
                  )
                }
                // Tiêu đề cột chỉ có khi các ô thẳng cột (từ `md`)
                header={
                  <div aria-hidden className={`hidden ${ROW_GRID} px-3 pt-1.5 pb-2 text-caption font-semibold text-on-surface-muted`}>
                    <span className="pl-12">{t("templates.cols.name")}</span>
                    <span>{t("templates.cols.structure")}</span>
                    <span>{t("templates.cols.uses")}</span>
                    <span>{t("templates.cols.saved")}</span>
                    <span />
                  </div>
                }
                renderItem={(tpl) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0 pr-10 md:pr-0">
                      <span aria-hidden className="size-9 shrink-0 rounded-control bg-primary-soft text-primary flex items-center justify-center">
                        <Icon name="file" size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-heading font-semibold text-on-surface truncate" title={tpl.name}>
                          {tpl.name}
                        </p>
                        <p className="text-caption text-on-surface-muted truncate" title={tpl.source_file_name}>
                          {tpl.source_file_name}
                        </p>
                      </div>
                    </div>
                    {/* Dưới `md`: ba ô meta nằm một hàng dưới tên, thẳng mép chữ (bỏ qua icon) */}
                    <div className="contents max-md:flex max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-1 max-md:pl-12 text-body text-on-surface-variant tabular-nums">
                      <span>
                        {t("templates.headingsCount", { count: tpl.heading_count })}
                        {tpl.custom_count > 0 && <span className="text-on-surface-muted"> · {t("templates.customsCount", { count: tpl.custom_count })}</span>}
                      </span>
                      <span className={tpl.uses > 0 ? "text-on-surface font-semibold" : "text-on-surface-muted"}>
                        {t("templates.usesCount", { count: tpl.uses })}
                      </span>
                      <span className="text-on-surface-muted">{date(tpl.created_at)}</span>
                    </div>
                    {/* Hành động phá huỷ nằm trong menu ⋮ — mobile ghim góc phải dòng */}
                    <div className="absolute right-2 top-3 md:static">
                      {canEdit && (
                        <DropdownMenu
                          items={[
                            {
                              label: t("delete"),
                              icon: "trash",
                              tone: "danger",
                              disabled: busy,
                              onSelect: () => setPendingDelete({ id: tpl.id, name: tpl.name }),
                            },
                          ]}
                          trigger={(props) => <IconButton {...props} icon="more" size="sm" label={t("rowActions", { name: tpl.name })} />}
                        />
                      )}
                    </div>
                  </>
                )}
              />

              {!list.loading && <p className="text-caption text-on-surface-muted leading-[1.5] max-w-[720px]">{t("templates.help")}</p>}
            </section>
          )}
        </div>
      </div>

      <Modal open={pendingDelete !== null} onClose={closeDelete} title={t("deleteTemplateTitle")}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-on-surface-muted leading-[1.6]">{t("deleteBody", { name: pendingDelete?.name ?? "" })}</p>
          {deleteError && (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDelete} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              {t("confirmDelete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
