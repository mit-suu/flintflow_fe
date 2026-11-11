"use client";

/**
 * FLF-375: hiển thị một chỗ của change request cho người đọc — dùng chung cho khung chat (nơi làm việc) và popup CR
 * (chỉ đọc). Tên chỗ, nội dung trước / sau lấy từ `display` BE trả (không lộ mã nội bộ như `CS11`, `[id=…]`, `fixed:…`).
 */
import { useTranslations } from "next-intl";
import type { CrLocation } from "@/types/change-request";
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

/** FLF-375: đề xuất dạng câu như Track Changes — xoá "Xoá: …", thêm "Thêm: …", sửa: chữ cũ gạch / chữ mới. */
export function ProposalDiff({ loc }: { loc: CrLocation }) {
  const t = useTranslations("mode1.crThread.diff");
  const d = loc.display;
  const p = loc.proposal;
  if (!d || !p) return p && loc.conclusion === "edit" ? <FieldChanges oldText={p.old_text} newText={p.new_text} /> : null;
  if (d.change === "remove")
    return (
      <p className="rounded-[8px] bg-[#FDF4F4] px-2.5 py-1.5">
        <strong className="text-[#B03030]">{t("remove")}</strong> <del className="text-[#B03030]">{d.label || d.before}</del>
      </p>
    );
  if (d.change === "add")
    return (
      <p className="rounded-[8px] bg-[#F3FAF6] px-2.5 py-1.5 whitespace-pre-wrap">
        <strong className="text-[#1F7A45]">{t("add")}</strong> {d.after}
      </p>
    );
  if (d.change !== "edit") return null;
  // Đề xuất chưa chạy thử được (op hỏng) — nói rõ, không hiện thành "xoá"
  if (d.after === null) return <p className="rounded-[8px] bg-[#FBF4E4] px-2.5 py-1.5 text-[#8A6D1F]">{t("noPreview")}</p>;
  return (
    <div className="grid gap-1 text-body">
      <p className="rounded-[8px] bg-[#FDF4F4] px-2.5 py-1.5 whitespace-pre-wrap">
        <span className="text-caption font-bold text-[#B03030] block">{t("before")}</span>
        <del className="text-[#8A4141]">{d.before}</del>
      </p>
      <p className="rounded-[8px] bg-[#F3FAF6] px-2.5 py-1.5 whitespace-pre-wrap">
        <span className="text-caption font-bold text-[#1F7A45] block">{t("after")}</span>
        <ins className="no-underline text-[#1F5A35]">{d.after}</ins>
      </p>
    </div>
  );
}

/** FLF-375 (BF §3.2): người khác có bản sửa chưa xác nhận ở cùng chỗ — chỉ báo, không chặn ai. */
export function OthersPending({ loc }: { loc: CrLocation }) {
  const t = useTranslations("mode1.crThread.loc");
  if (!loc.others_pending?.length) return null;
  return <p className="text-caption text-[#8A6D1F]">{loc.others_pending.map((o) => t("othersPending", { who: o.requester || o.cr_id, crId: o.cr_id })).join(" · ")}</p>;
}

