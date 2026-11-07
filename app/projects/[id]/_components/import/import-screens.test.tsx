import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { CreditEstimate, ImportedDocument, StructurePreview as Preview } from "@/types/import";
import StructurePreview from "./structure-preview";
import ImportProgress from "./import-progress";

const preview: Preview = {
  summary: { present: 2, missing: 1, out_of_scope: 1, kind: "written" },
  resolved_mode: 3,
  intent: "fixed",
  computed_at: "2026-11-08T00:00:00.000Z",
  sections: [
    { section_id: "fixed:1", title: "1 Overview", status: "present", order: 0 },
    { section_id: "fixed:2.3", title: "2.3 Business rules", status: "missing", order: 1 },
    { section_id: "fixed:2.2", title: "2.2 Use cases", status: "present", order: 2 },
    { section_id: "custom:CS01", title: "Budget", status: "out_of_scope", order: 3 },
  ],
};
const estimate = (credits: number, available: number | null): CreditEstimate => ({ text_batches: 3, diagram_images: 1, ai_calls: 4, credits, available_credits: available });
const handlers = () => ({ onStart: vi.fn(), onDownloadGapReport: vi.fn(), onPickAnother: vi.fn() });

describe("StructurePreview — màn đọc khung (business-flow §3.1.2)", () => {
  it("tóm tắt, bản đồ mục theo thứ tự file kèm trạng thái chữ (không chỉ màu), mục ngoài phạm vi có ghi chú; 1 dòng credit + Bắt đầu", () => {
    const h = handlers();
    renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={estimate(12, 100)} credits={100} {...h} />);
    expect(screen.getByRole("heading", { name: "SRS đã viết · 2/3 mục có nội dung" })).toBeInTheDocument();
    expect(screen.getByText(/Còn 1 mục trống/)).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("1 Overview");
    expect(rows[1]).toContain("2.3 Business rules");
    expect(rows[1]).toContain("Còn trống");
    expect(rows[3]).toContain("Giữ nguyên, không kiểm");
    expect(screen.getByText(/~/)).toHaveTextContent("Dự kiến ~12 credit");
    expect(screen.getByText(/bạn còn 100/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));
    expect(h.onStart).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Tải báo cáo thiếu sót/ }));
    expect(h.onDownloadGapReport).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(h.onPickAnother).toHaveBeenCalled();
  });

  it("thiếu credit ⇒ khoá Bắt đầu + link nạp credit", () => {
    renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={estimate(50, 10)} credits={10} {...handlers()} />);
    expect(screen.getByRole("button", { name: /Bắt đầu/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");
  });

  it("khung mẫu + chưa chắc là SRS ⇒ câu tóm tắt khung mẫu và dòng nhắc; import cũ không có bản sơ bộ ⇒ chỉ còn credit + Bắt đầu", () => {
    const { unmount } = renderWithIntl(
      <StructurePreview fileName="Mau.docx" preview={{ ...preview, summary: { ...preview.summary, kind: "template", present: 0, missing: 3 } }} estimate={null} credits={5} unsureKind {...handlers()} />
    );
    expect(screen.getByRole("heading", { name: /Khung mẫu · 0\/3/ })).toBeInTheDocument();
    expect(screen.getByText(/chưa chắc đây là tài liệu SRS/)).toBeInTheDocument();
    unmount();
    renderWithIntl(<StructurePreview fileName="Old.docx" preview={null} estimate={estimate(6, 50)} credits={50} {...handlers()} />);
    expect(screen.getByRole("heading", { name: "Sẵn sàng đọc file" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("chữ trên màn không còn thuật ngữ nội bộ; bản tiếng Anh không sót tiếng Việt", () => {
    const { container, unmount } = renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={estimate(12, 100)} credits={100} {...handlers()} />);
    expect(container.textContent).not.toMatch(/\b(block|field|section|mapping|baseline|v0)\b|tất định|quyết toán|S-\d/i);
    unmount();
    const en = renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={estimate(12, 100)} credits={100} {...handlers()} />, "en");
    expect(vietnameseLeftovers(en.container)).toEqual([]);
  });
});

const doc = (over: Partial<ImportedDocument>): ImportedDocument =>
  ({
    id: "i1",
    project_id: "p1",
    original_name: "SRS.docx",
    size: 1,
    sha256: "x".repeat(64),
    status: "extracting",
    preflight: { status: "accepted", issues: [], document_kind: null },
    stamp: null,
    confirmed_latest_at: null,
    paused: null,
    extract_cursor: "c1",
    reread: null,
    created_at: "2026-11-08T00:00:00.000Z",
    updated_at: "2026-11-08T00:00:00.000Z",
    ...over,
  }) as ImportedDocument;

describe("ImportProgress — tiến trình đọc file", () => {
  it("ba pha chữ thường; pha hiện tại đánh dấu bước đang làm, kèm x/y mục; có thể rời trang", () => {
    renderWithIntl(<ImportProgress doc={doc({})} sections={[{ section_id: "fixed:1", status: "done", fields_total: 1, fields_needing_review: 0, error: null }, { section_id: "fixed:2.1", status: "pending", fields_total: 0, fields_needing_review: 0, error: null }]} onResume={() => {}} />);
    expect(screen.getByText(/Có thể rời trang/)).toBeInTheDocument();
    const current = screen.getByRole("listitem", { current: "step" });
    expect(current).toHaveTextContent("Đọc nội dung");
    expect(current).toHaveTextContent("1/2 mục");
  });

  it("dựng tài liệu bị dừng ⇒ banner Tiếp tục; AI quá tải ⇒ dòng đọc lại ảnh", () => {
    const onResume = vi.fn();
    renderWithIntl(<ImportProgress doc={doc({ status: "baselining", paused: { reason: "resume_later", at: "2026-11-08T00:00:00.000Z" }, reread: { kind: "images", done: 2, total: 5, section_id: "fixed:2.2.1" } })} sections={[]} onResume={onResume} />);
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Dựng tài liệu");
    expect(screen.getByText(/đọc lại ảnh 2\/5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    expect(onResume).toHaveBeenCalled();
  });
});
