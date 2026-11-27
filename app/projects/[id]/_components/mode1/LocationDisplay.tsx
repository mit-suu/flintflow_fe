"use client";

/**
 * FLF-375: hiển thị một chỗ của change request cho người đọc — dùng chung cho khung chat (nơi làm việc) và popup CR
 * (chỉ đọc). Tên chỗ, nội dung trước / sau lấy từ `display` BE trả (không lộ mã nội bộ như `CS11`, `[id=…]`, `fixed:…`).
 */
import { useTranslations } from "next-intl";
import type { CrLocation } from "@/types/change-request";
import BlockDiff, { textChange } from "./BlockDiff";
import FieldChanges from "./FieldChanges";
import { useMode1Labels } from "./i18n";

/** FLF-375: tên chỗ người đọc được — loại (dịch theo giao diện) + tên / trích đoạn từ BE; CR cũ chưa có `display` ⇒ nhãn path. */
export function useLocTitle(): (loc: CrLocation) => string {
  const t = useTranslations("mode1.crThread.kinds");
  const { pathLabel, entityLabel } = useMode1Labels();
  return (loc) => {
    const d = loc.display;
    if (!d) return pathLabel(loc.path);
    const kind = d.kind === "paragraph" || d.kind === "table" || d.kind === "image" ? t(d.kind) : entityLabel(d.kind);
    return d.label ? `${kind}: ${d.label}` : kind;
  };
}

/**
 * FLF-375: đề xuất của một chỗ, hiện y như so sánh version (`BlockDiff`): xoá = ô đỏ gạch ngang, thêm = ô xanh, sửa = một ô chỉ tô
 * từ bị đổi (viết lại gần hết thì hai ô cũ / mới). Dùng ở cả khung chat lẫn popup CR.
 */
export function ProposalDiff({ loc }: { loc: CrLocation }) {
  const t = useTranslations("mode1.crThread.diff");
  const d = loc.display;
  const p = loc.proposal;
  if (!d || !p) return p && loc.conclusion === "edit" ? <FieldChanges oldText={p.old_text} newText={p.new_text} /> : null;
  // Xoá: tên chỗ ngắn gọn hơn cả nội dung; không có tên / chữ (vd thông báo không đọc được nội dung) ⇒ vẫn nói rõ là xoá phần này
  if (d.change === "remove") return <BlockDiff entry={{ block_id: null, change: "removed", before: d.label || d.before || t("removeUnnamed") }} />;
  if (d.change === "add") return <BlockDiff entry={{ block_id: null, change: "added", after: d.after ?? "" }} />;
  if (d.change !== "edit") return null;
  // Đề xuất chưa chạy thử được (op hỏng) — nói rõ, không hiện thành "xoá"
  if (d.after === null) return <p className="text-body rounded-control bg-accent-gold-soft px-3 py-2 text-accent-gold-text">{t("noPreview")}</p>;
  // Trước và sau như nhau (vd bỏ một mục phạm vi khi phần phạm vi đang trống) ⇒ nói thẳng là không đổi gì, không vẽ ô rỗng
  if (d.after.trim() === (d.before ?? "").trim()) return <p className="text-body rounded-control bg-surface-container-high px-3 py-2 text-on-surface-variant">{t("noChange")}</p>;
  return <BlockDiff entry={textChange(d.before ?? "", d.after)} />;
}

/** FLF-375 (BF §3.2): người khác có bản sửa chưa xác nhận ở cùng chỗ — chỉ báo, không chặn ai. */
export function OthersPending({ loc }: { loc: CrLocation }) {
  const t = useTranslations("mode1.crThread.loc");
  if (!loc.others_pending?.length) return null;
  return <p className="text-caption text-[#8A6D1F]">{loc.others_pending.map((o) => t("othersPending", { who: o.requester || o.cr_id, crId: o.cr_id })).join(" · ")}</p>;
}

