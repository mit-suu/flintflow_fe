"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import {
  Badge,
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
import PendingHeadingsReview from "@/components/org-template/pending-headings-review";
import NewTemplateUpload from "@/components/org-template/new-template-upload";
import { MappingReviewDialog, TemplateVersionsDialog } from "@/components/org-template/template-library-dialogs";
import { fetchOrganization } from "@/lib/api/orgs";
import { deleteOrgTemplate, listOrgTemplatesPage, uploadTemplateVersion, type OrgTemplateSort } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { TemplateVersionDetail } from "@/types/org-library";
import type { OrgRole } from "@/types/organization";

/** Mẫu chờ xác nhận xoá — giữ tên để hộp thoại nói rõ đang xoá cái gì. */
type PendingDelete = { id: string; name: string; projects: number } | null;

const SORTS: readonly OrgTemplateSort[] = ["uses", "recent", "name"];
const PAGE_SIZE = 20;

/** Cột của dòng từ `md`: tên | cấu trúc | lượt dùng | ngày lưu | menu. Dưới `md` các ô xếp dưới tên. */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_200px_120px_120px_32px] md:items-center md:gap-4";

/**
 * Thư viện mẫu của tổ chức (FLF-278): mẫu SRS đã lưu từ dự án theo mẫu khách — file mẫu + mapping heading đã xác nhận,
 * dự án sau chọn lại ở ô SRS khi tạo dự án. Mọi thành viên xem các bản; chỉ Lead tải mẫu, đăng bản mới (qua hộp rà mapping) và
 * xoá (FLF-395) — BE kiểm lại bằng `requireRole`. Lead + Analyst duyệt mục chờ của mẫu khung tự lưu.
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
  /** Mẫu đang mở hộp "Các bản" (id — dữ liệu lấy từ danh sách để luôn mới sau khi tải lại). */
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  /** Bản nháp đang rà mapping trước khi đăng. */
  const [review, setReview] = useState<TemplateVersionDetail | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  /** Mẫu khung tự lưu đang mở hộp duyệt mục chờ (duyệt qua dự án nguồn). */
  const [pendingOf, setPendingOf] = useState<{ projectId: string; name: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Input file dùng chung cho "Đăng bản mới" — giữ mẫu đích tới khi người dùng chọn file. */
  const versionFileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);
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

  const isLead = role === "lead";
  const canReviewPending = role === "lead" || role === "analyst";
  const versionsTemplate = versionsOf ? (list.items.find((tpl) => tpl.id === versionsOf) ?? null) : null;
  /** Tổ chức thật sự chưa có mẫu nào (không phải "không khớp từ khoá"). */
  const orgEmpty = !list.loading && !list.error && q === "" && list.total === 0;
  const listError = list.error ? userErrorMessage(list.error) : (roleError ?? actionError);

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

  const uploadVersion = async (file: File | undefined) => {
    const templateId = uploadTarget.current;
    if (!orgId || !file || !templateId) return;
    setBusy(true);
    setActionError(null);
    try {
      const detail = await uploadTemplateVersion(orgId, templateId, file);
      list.reload();
      setReview(detail);
    } catch (err) {
      setActionError(userErrorMessage(err));
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
              {isLead && (
                <Button size="sm" className="ml-auto" disabled={busy} onClick={() => setNewOpen(true)}>
                  <Icon name="upload" size={15} />
                  {t("templates.newTemplate")}
                </Button>
              )}
            </div>
            <p className="text-body text-on-surface-muted leading-[1.6] max-w-[720px]">{t("intro")}</p>
            {role !== null && !isLead && (
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
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {tpl.latest_version > 0 ? <Badge tone="primary">{t("templates.latest", { version: tpl.latest_version })}</Badge> : <Badge tone="neutral">{t("templates.draftOnly")}</Badge>}
                          {tpl.skeleton && <Badge tone="info">{t("templates.skeleton")}</Badge>}
                          {tpl.pending_count > 0 && <Badge tone="warning">{t("templates.pending", { count: tpl.pending_count })}</Badge>}
                        </div>
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
                      <DropdownMenu
                        items={[
                          { label: t("templates.versions"), icon: "history" as const, onSelect: () => setVersionsOf(tpl.id) },
                          ...(canReviewPending && tpl.pending_count > 0 && tpl.skeleton_source_project_id
                            ? [{ label: t("templates.reviewPending"), icon: "check-circle" as const, onSelect: () => setPendingOf({ projectId: tpl.skeleton_source_project_id!, name: tpl.name }) }]
                            : []),
                          ...(isLead
                            ? [
                                {
                                  label: t("templates.publishNew"),
                                  icon: "upload" as const,
                                  disabled: busy,
                                  onSelect: () => {
                                    uploadTarget.current = tpl.id;
                                    versionFileRef.current?.click();
                                  },
                                },
                                {
                                  label: t("templates.delete"),
                                  icon: "trash" as const,
                                  tone: "danger" as const,
                                  disabled: busy,
                                  onSelect: () => setPendingDelete({ id: tpl.id, name: tpl.name, projects: tpl.project_count }),
                                },
                              ]
                            : []),
                        ]}
                        trigger={(props) => <IconButton {...props} icon="more" size="sm" label={t("rowActions", { name: tpl.name })} />}
                      />
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
          <p className="text-body text-on-surface-variant leading-[1.6]">{t("templates.confirmFamily", { count: pendingDelete?.projects ?? 0 })}</p>
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

      <input
        ref={versionFileRef}
        type="file"
        accept=".docx"
        hidden
        aria-label={t("templates.pickVersionFile")}
        onChange={(e) => {
          void uploadVersion(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {/* Tải mẫu mới: đặt tên + chọn file ⇒ rà mapping (cảnh báo mẫu còn chữ) ⇒ đăng, cùng luồng với hộp Tạo dự án (FLF-412) */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t("templates.newTemplate")} size="xl">
        {newOpen && orgId && (
          <NewTemplateUpload
            orgId={orgId}
            onCancel={() => setNewOpen(false)}
            onPublished={() => {
              setNewOpen(false);
              list.reload();
            }}
          />
        )}
      </Modal>
      {versionsTemplate && orgId && (
        <TemplateVersionsDialog
          orgId={orgId}
          template={versionsTemplate}
          isLead={isLead}
          onClose={() => setVersionsOf(null)}
          onReview={(detail) => {
            setVersionsOf(null);
            setReview(detail);
          }}
          onChanged={list.reload}
        />
      )}
      {review && orgId && (
        <MappingReviewDialog
          orgId={orgId}
          detail={review}
          onClose={() => setReview(null)}
          onPublished={() => {
            setReview(null);
            list.reload();
          }}
        />
      )}
      <Modal open={pendingOf !== null} onClose={() => setPendingOf(null)} title={t("templates.reviewPending")} size="lg">
        {pendingOf && <PendingHeadingsReview projectId={pendingOf.projectId} canReview={canReviewPending} onChange={() => list.reload()} />}
      </Modal>
    </>
  );
}
