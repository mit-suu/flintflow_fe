"use client";

import { useTranslations } from "next-intl";
import type { CrLocation } from "@/types/change-request";
import type { OriginalDiagramKind } from "@/types/spine";

/**
 * Vị trí "sơ đồ gốc" của CR (contract §4.13, `found_by: diagram`): phần nối đang giữ hình người dùng vẽ sẵn (draw.io…).
 * BE tự đề xuất (không qua AI): dữ liệu hình thể hiện đổi theo CR ⇒ bỏ ảnh gốc, tài liệu in sơ đồ FlintFlow vẽ lại;
 * không đổi ⇒ không liên quan. Hiển thị bằng lời thay cho diff JSON của khối ảnh.
 */

/** Translator của namespace `mode1.originalDiagram` — tên loại sơ đồ + tiêu đề vị trí. */
export type DiagramTranslator = ReturnType<typeof useTranslations<"mode1.originalDiagram">>;

export const isDiagramLocation = (loc: Pick<CrLocation, "found_by">): boolean => loc.found_by.includes("diagram");

type Block = { kind?: string; text?: string; image_ref?: string | null; diagram?: { kind: OriginalDiagramKind } | null };

const blocksOf = (text: string | null | undefined): Block[] => {
  if (!text) return [];
  try {
    const value = JSON.parse(text) as { blocks?: Block[] };
    return Array.isArray(value.blocks) ? value.blocks : [];
  } catch {
    return [];
  }
};

/** Hình gốc có trong giá trị cũ mà giá trị mới không còn (theo `image_ref`). */
export const replacedDiagrams = (loc: Pick<CrLocation, "proposal" | "current_text">): { kind: OriginalDiagramKind; caption: string }[] => {
  const before = blocksOf(loc.proposal?.old_text ?? loc.current_text).filter((b) => b.kind === "image" && b.diagram);
  const kept = new Set(blocksOf(loc.proposal?.new_text).map((b) => b.image_ref));
  return before.filter((b) => !kept.has(b.image_ref)).map((b) => ({ kind: b.diagram!.kind, caption: (b.text ?? "").trim() }));
};

/** Tên hiển thị của vị trí: "Hình gốc — Sơ đồ use case" thay cho "Mục riêng CS03". */
export const diagramLocationTitle = (loc: Pick<CrLocation, "proposal" | "current_text">, t: DiagramTranslator): string => {
  const kinds = [...new Set(blocksOf(loc.proposal?.old_text ?? loc.current_text).flatMap((b) => (b.kind === "image" && b.diagram ? [b.diagram.kind] : [])))];
  return kinds.length ? t("title", { kinds: kinds.map((k) => t(`kinds.${k}`)).join(", ") }) : t("titleFallback");
};

/** Nội dung đề xuất `edit` của vị trí sơ đồ gốc: hình nào bị thay, thay bằng gì. */
export default function OriginalDiagramChange({ loc }: { loc: Pick<CrLocation, "proposal" | "current_text"> }) {
  const t = useTranslations("mode1.originalDiagram");
  const replaced = replacedDiagrams(loc);
  if (!replaced.length) return null;
  return (
    <div className="rounded-[8px] bg-[#F2F1FB] px-2.5 py-1.5 text-body text-[#3F3894]" aria-label={t("aria")}>
      <p className="font-bold">{t("replace")}</p>
      <ul className="list-disc pl-5">
        {replaced.map((r, i) => (
          <li key={i}>
            {t(`kinds.${r.kind}`)}
            {r.caption ? t("caption", { caption: r.caption }) : ""}
          </li>
        ))}
      </ul>
      <p className="text-body text-[#6B6862]">{t("decline")}</p>
    </div>
  );
}
