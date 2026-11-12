"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Icon, Modal, SearchInput, Skeleton } from "@/components/ui";
import { listOrgTemplatesPage } from "@/lib/api/org-library";
import { userErrorMessage } from "@/lib/api/error-messages";
import { getActiveOrgId } from "@/lib/api/token-store";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { OrgTemplateSummary } from "@/types/org-library";

interface OrgTemplatePickerProps {
  disabled?: boolean;
  onPick: (template: OrgTemplateSummary) => void;
}

/** Chờ người dùng ngừng gõ rồi mới gọi BE tìm. */
const SEARCH_DEBOUNCE_MS = 250;

/** Số mẫu đã biết của từng tổ chức trong tab này — mở lại hộp Tạo dự án thì nút có số ngay, BE chỉ cập nhật lại. */
const knownTotals = new Map<string, number>();

/**
 * FLF-278 — lối phụ của ô SRS: thay cho tải file, chọn mẫu đã lưu của tổ chức (BE nhập từ chính file mẫu đó, mapping heading đã
 * xác nhận ở dự án trước áp sẵn). Tổ chức chưa lưu mẫu nào hoặc tải lỗi ⇒ không hiện gì (tải file vẫn là đường chính).
 * Trong hộp Tạo dự án chỉ là một nút; tổ chức có thể có hàng trăm mẫu nên danh sách nằm ở hộp chọn riêng, có tìm kiếm và tải
 * dần khi cuộn, không đẩy dài hộp Tạo dự án.
 */
export default function OrgTemplatePicker({ disabled = false, onPick }: OrgTemplatePickerProps) {
  const t = useTranslations("app.createProject.orgTemplates");
  // `null` = chưa biết. Nút hiện ngay khi mở hộp Tạo dự án (không chờ BE rồi mới bật ra cạnh ô thả file), số mẫu điền sau;
  // lần mở sau lấy số đã nhớ của tổ chức. Chỉ ẩn khi chắc chắn tổ chức không có mẫu nào.
  const [total, setTotal] = useState<number | null>(() => {
    const orgId = getActiveOrgId();
    return orgId ? (knownTotals.get(orgId) ?? null) : 0;
  });
  const [open, setOpen] = useState(false);

  // Chỉ cần biết tổ chức có mẫu nào không (và bao nhiêu) — một trang 1 mục là đủ, danh sách thật tải trong hộp chọn
  useEffect(() => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    let cancelled = false;
    listOrgTemplatesPage(orgId, { page: 1, limit: 1 })
      .then((res) => {
        knownTotals.set(orgId, res.meta.total);
        if (!cancelled) setTotal(res.meta.total);
      })
      .catch(() => !cancelled && setTotal(0));
    return () => {
      cancelled = true;
    };
  }, []);

  if (total === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        disabled={disabled}
        className="self-start inline-flex items-center gap-1.5 text-caption font-bold text-primary hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name="file-template" size={14} />
        {total === null ? t("toggleNoCount") : t("toggle", { count: total })}
      </button>
      {open && (
        <TemplatePickerDialog
          onClose={() => setOpen(false)}
          onPick={(tpl) => {
            setOpen(false);
            onPick(tpl);
          }}
        />
      )}
    </>
  );
}

interface TemplatePickerDialogProps {
  onClose: () => void;
  onPick: (template: OrgTemplateSummary) => void;
}

function TemplatePickerDialog({ onClose, onPick }: TemplatePickerDialogProps) {
  const t = useTranslations("app.createProject.orgTemplates");
  const tc = useTranslations("app.common");
  const orgId = getActiveOrgId();
  const [query, setQuery] = useState("");
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  // Vùng cuộn lấy bằng callback ref + state (hook cần phần tử thật để tính `rootMargin`, không nhận ref)
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const { items, total, loading, loadingMore, error, loadMoreError, retry, sentinelRef } = useInfiniteList<OrgTemplateSummary>({
    fetchPage: (page) => listOrgTemplatesPage(orgId ?? "", { page, q: search || undefined, sort: "uses" }),
    key: search,
    enabled: orgId !== null,
    root: scrollEl,
  });

  return (
    <Modal open onClose={onClose} title={t("title")} size="lg">
      <div className="flex flex-col gap-3">
        <SearchInput value={query} onChange={setQuery} label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="h-10" />
        <p className="min-h-[1lh] text-caption text-on-surface-muted" aria-live="polite">
          {loading ? null : search ? t("resultCount", { count: total }) : t("sortedByUses", { count: total })}
        </p>

        {/* Vùng cuộn riêng của danh sách: ô tìm luôn ở trên, hộp không cao quá màn hình dù có hàng trăm mẫu */}
        <div ref={setScrollEl}className="h-[min(56vh,520px)] overflow-y-auto ff-scroll -mx-2 px-2">
          {loading ? (
            <ul className="flex flex-col gap-1.5" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[60px] w-full" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <EmptyState icon="warning" title={t("loadError")} description={userErrorMessage(error)} />
          ) : items.length === 0 ? (
            <EmptyState icon="search" title={t("noMatch", { query: search })} description={t("noMatchHint")} />
          ) : (
            <ul aria-label={t("title")} className="flex flex-col gap-1.5">
              {items.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => onPick(tpl)}
                    title={tpl.name}
                    className="group w-full text-left flex items-center gap-3 rounded-control px-3.5 py-2.5 bg-surface-container hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer transition-colors"
                  >
                    <span className="shrink-0 w-9 h-9 rounded-control bg-surface-container-lowest text-primary flex items-center justify-center">
                      <Icon name="file-template" size={16} />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-body font-semibold text-on-surface line-clamp-2 break-words">{tpl.name}</span>
                      <span className="text-caption text-on-surface-muted truncate">
                        {t("meta", { file: tpl.source_file_name, headings: tpl.heading_count, uses: tpl.uses })}
                      </span>
                    </span>
                    <span className="shrink-0 text-caption font-bold text-primary opacity-70 group-hover:opacity-100 group-focus-visible:opacity-100">
                      {t("use")}
                    </span>
                  </button>
                </li>
              ))}
              <li ref={sentinelRef} aria-hidden className="h-px" />
              {loadingMore && (
                <li className="flex justify-center py-3 text-on-surface-muted">
                  <Icon name="spinner" size={16} className="animate-spin" />
                </li>
              )}
              {loadMoreError != null && (
                <li className="flex justify-center py-2">
                  <button type="button" onClick={retry} className="text-caption font-bold text-primary hover:underline cursor-pointer">
                    {tc("retry")}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
