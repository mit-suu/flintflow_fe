"use client";

import type { CrLocation } from "@/types/change-request";
import type { OriginalDiagramKind } from "@/types/spine";

/**
 * Vị trí "sơ đồ gốc" của CR (contract §4.13, `found_by: diagram`): phần nối đang giữ hình người dùng vẽ sẵn (draw.io…).
 * BE tự đề xuất (không qua AI): dữ liệu hình thể hiện đổi theo CR ⇒ bỏ ảnh gốc, tài liệu in sơ đồ FlintFlow vẽ lại;
 * không đổi ⇒ không liên quan. Hiển thị bằng lời thay cho diff JSON của khối ảnh.
 */

export const ORIGINAL_DIAGRAM_LABELS: Record<OriginalDiagramKind, string> = {
  context: "Sơ đồ ngữ cảnh",
  usecase: "Sơ đồ use case",
  screen_flow: "Sơ đồ luồng màn hình",
  erd: "Sơ đồ quan hệ thực thể",
};

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
export const diagramLocationTitle = (loc: Pick<CrLocation, "proposal" | "current_text">): string => {
  const kinds = [...new Set(blocksOf(loc.proposal?.old_text ?? loc.current_text).flatMap((b) => (b.kind === "image" && b.diagram ? [b.diagram.kind] : [])))];
  return kinds.length ? `Hình gốc — ${kinds.map((k) => ORIGINAL_DIAGRAM_LABELS[k]).join(", ")}` : "Hình gốc của tài liệu";
};

/** Nội dung đề xuất `edit` của vị trí sơ đồ gốc: hình nào bị thay, thay bằng gì. */
export default function OriginalDiagramChange({ loc }: { loc: Pick<CrLocation, "proposal" | "current_text"> }) {
  const replaced = replacedDiagrams(loc);
  if (!replaced.length) return null;
  return (
    <div className="rounded-[8px] bg-[#F2F1FB] px-2.5 py-1.5 text-[12px] text-[#3F3894]" aria-label="Thay hình gốc">
      <p className="font-bold">🖼 Thay hình gốc bằng sơ đồ FlintFlow vẽ lại từ dữ liệu mới</p>
      <ul className="list-disc pl-5">
        {replaced.map((r, i) => (
          <li key={i}>
            {ORIGINAL_DIAGRAM_LABELS[r.kind]}
            {r.caption ? ` (“${r.caption}”)` : ""}
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-[#6B6862]">Không đồng ý ⇒ giữ hình gốc của bạn; tài liệu có cờ vàng “Hình gốc lệch dữ liệu”.</p>
    </div>
  );
}
