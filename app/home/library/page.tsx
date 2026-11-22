"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import {
  Badge,
  Button,
  DropdownMenu,
  EmptyState,
  Icon,
  IconButton,
  InfiniteDataList,
  Modal,
} from "@/components/ui";
import TemplateProposalsSection from "@/components/org-template/template-proposals-section";
import NewTemplateUpload from "@/components/org-template/new-template-upload";
import { MappingReviewDialog, TemplateVersionsDialog } from "@/components/org-template/template-library-dialogs";
import { useActiveOrganizationState } from "@/lib/hooks/use-active-org";
import LibraryShell, { LIBRARY_ROW_CLASS, LIBRARY_SKELETON_ROWS, LibraryColumnHeader, LibraryRowSkeleton, LibraryToolbar } from "@/components/page-shells/LibraryShell";
import { deleteOrgTemplate, listOrgTemplatesPage, uploadTemplateVersion, type OrgTemplateSort } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import { userErrorMessage } from "@/lib/api/error-messages";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { TemplateVersionDetail } from "@/types/org-library";
import type { OrgRole } from "@/types/organization";

/** Mẫu chờ xác nhận xoá — giữ tên để hộp thoại nói rõ đang xoá cái gì. */
type PendingDelete = { id: string; name: string; projects: number } | null;

const PAGE_SIZE = 20;

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
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  /** Mẫu đang mở hộp "Các bản" (id — dữ liệu lấy từ danh sách để luôn mới sau khi tải lại). */
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  /** Bản nháp đang rà mapping trước khi đăng. */
  const [review, setReview] = useState<TemplateVersionDetail | null>(null);
  const [newOpen, setNewOpen] = useState(false);
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

  // Vai trò lấy từ store tổ chức dùng chung (có bản nhớ lần trước) ⇒ nút "Tải mẫu mới" của Lead hiện ngay từ đầu, không
  // chen vào sau một lượt `GET /orgs/:id` riêng của trang rồi đẩy đoạn giới thiệu xuống
  const { org: activeOrg, error: orgError } = useActiveOrganizationState();
  const role: OrgRole | null = activeOrg?.role ?? null;
  const isLead = role === "lead";
  const versionsTemplate = versionsOf ? (list.items.find((tpl) => tpl.id === versionsOf) ?? null) : null;
  /** Tổ chức thật sự chưa có mẫu nào (không phải "không khớp từ khoá"). */
  const orgEmpty = !list.loading && !list.error && q === "" && list.total === 0;
  // Không đọc được tổ chức (store báo lỗi, không còn bản nhớ) ⇒ câu lỗi chung, như khi trang tự tải vai trò trước đây
  const roleError = orgError ? userErrorMessage(null) : null;
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
      <LibraryShell
        scrollRef={setScrollEl}
        count={q === "" ? list.total : undefined}
        role={role}
        uploadDisabled={busy}
        onUpload={() => setNewOpen(true)}
        alert={
          listError && (
            <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
              {listError}
            </p>
          )
        }
      >
        {/* UC-88: đề xuất mẫu Analyst gửi từ dự án chờ Lead duyệt */}
        {isLead && orgId && <TemplateProposalsSection orgId={orgId} onDecided={list.reload} />}

        {orgEmpty ? (
          // Chưa có mẫu: nói luôn mẫu được tạo ở đâu, vì trang này không có nút thêm
          <EmptyState icon="layers" title={t("templates.empty")} description={t("templates.help")} className="rounded-card bg-surface-container-low !py-12" />
        ) : (
          <section aria-label={t("title")} className="flex flex-col gap-3">
            <LibraryToolbar
              query={query}
              onQueryChange={setQuery}
              sort={sort}
              onSortChange={setSort}
              resultCount={q !== "" && !list.loading ? list.total : null}
            />

            <InfiniteDataList
              list={list}
              getKey={(tpl) => tpl.id}
              loadingLabel={t("loading")}
              rowClassName={LIBRARY_ROW_CLASS}
              renderSkeletonRow={LibraryRowSkeleton}
              skeletonRows={LIBRARY_SKELETON_ROWS}
              empty={
                q !== "" && (
                  <p className="rounded-card bg-surface-container-low px-4 py-8 text-center text-body text-on-surface-muted">
                    {t("templates.noMatch", { query: q })}
                  </p>
                )
              }
              header={<LibraryColumnHeader />}
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
                        {/* UC-85: mẫu lưu từ dự án hiện như mẫu tổ chức thường, kèm dòng nguồn */}
                        {tpl.skeleton && tpl.skeleton_source_project_name && (
                          <span className="text-caption text-on-surface-muted">{t("templates.savedFromProject", { project: tpl.skeleton_source_project_name })}</span>
                        )}
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
      </LibraryShell>

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
    </>
  );
}
