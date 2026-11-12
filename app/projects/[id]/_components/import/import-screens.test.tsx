import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("StructurePreview - màn đọc khung (business-flow §3.1.2)", () => {
  // Đã xem hiệu ứng cắt mục ⇒ vào thẳng trạng thái đã lắng (nhãn trạng thái + mục còn trống hiện đủ)
  beforeEach(() => localStorage.setItem("ff:absorb-seen:preview", "1"));

  it("tóm tắt, bản đồ mục theo thứ tự file kèm trạng thái chữ (không chỉ màu), mục ngoài phạm vi có ghi chú; 1 dòng credit + Bắt đầu", () => {
    const h = handlers();
    renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={estimate(12, 100)} credits={100} {...h} />);
    expect(screen.getByRole("heading", { name: "SRS đã viết · 2/3 mục có nội dung" })).toBeInTheDocument();
    expect(screen.getByText(/Còn 1 mục trống/)).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("1 Overview");
    expect(rows[1]).toContain("2.3 Business rules");
    expect(rows[1]).toContain("Còn trống");
    expect(rows[3]).toContain("Ngoài phạm vi");
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

  it("FLF-411 U1-1: khung mẫu (chế độ 3) không nói \"đọc phần đã có\"; U3-3: mục không tên không in mã custom:CS02", () => {
    const tpl: Preview = {
      ...preview,
      summary: { present: 0, missing: 3, out_of_scope: 1, kind: "template" },
      sections: [...preview.sections.slice(0, 3), { section_id: "custom:CS02", title: "custom:CS02", status: "out_of_scope", order: 3 }],
    };
    const { container } = renderWithIntl(<StructurePreview fileName="Report3.docx" preview={tpl} estimate={null} credits={5} {...handlers()} />);
    expect(screen.getByText(/File là khung mẫu, chưa có nội dung để đọc/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/đọc phần đã có|bản gốc 0\.1/);
    expect(container.textContent).not.toContain("custom:CS02");
    expect(screen.getByText("Mục riêng")).toBeInTheDocument();
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

describe("ImportProgress - tiến trình đọc file", () => {
  it("ba pha chữ thường; pha hiện tại đánh dấu bước đang làm, kèm x/y mục; có thể rời trang", () => {
    renderWithIntl(<ImportProgress doc={doc({})} sections={[{ section_id: "fixed:1", status: "done", fields_total: 1, fields_needing_review: 0, error: null }, { section_id: "fixed:2.1", status: "pending", fields_total: 0, fields_needing_review: 0, error: null }]} onResume={() => {}} />);
    expect(screen.getByText(/Có thể rời trang/)).toBeInTheDocument();
    const current = screen.getByRole("listitem", { current: "step" });
    expect(current).toHaveTextContent("Đọc nội dung");
    expect(screen.getByText("mục đã đọc").parentElement).toHaveTextContent("1/2");
  });

  it("đang đọc nội dung ⇒ nút Dừng gọi onPause; người dùng đã dừng ⇒ thẻ Đã dừng + Tiếp tục (không phải banner lỗi)", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const sections = [{ section_id: "fixed:1", status: "done" as const, fields_total: 1, fields_needing_review: 0, error: null }, { section_id: "fixed:2.1", status: "pending" as const, fields_total: 0, fields_needing_review: 0, error: null }];
    const { unmount } = renderWithIntl(<ImportProgress doc={doc({})} sections={sections} onResume={onResume} onPause={onPause} />);
    fireEvent.click(screen.getByRole("button", { name: /Dừng đọc/ }));
    expect(onPause).toHaveBeenCalled();
    unmount();

    renderWithIntl(<ImportProgress doc={doc({ paused: { reason: "user", at: "2026-11-08T00:00:00.000Z" } })} sections={sections} onResume={onResume} onPause={onPause} />);
    expect(screen.getByRole("heading", { name: "Đã dừng đọc file" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã đọc 1/2 mục");
    expect(screen.queryByRole("button", { name: /Dừng đọc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/ }));
    expect(onResume).toHaveBeenCalled();
  });

  it("FLF-411 U-1 / #14: mục xếp theo thứ tự trong file (heading_map), không để mục nhóm BE đọc trước lên đầu; không in mã mục", () => {
    const sec = (section_id: string, status: "done" | "pending" = "pending") => ({ section_id, status, fields_total: 0, fields_needing_review: 0, error: null });
    const headings = [
      { block_id: "B0001", heading_text: "1. Product Overview", section_id: "fixed:1", confidence: 1, detected_by: "style", confirmed: true },
      { block_id: "B0002", heading_text: "2.1 Actors", section_id: "fixed:2.1", confidence: 1, detected_by: "style", confirmed: true },
      { block_id: "B0040", heading_text: "3.2 Ordering", section_id: "unmapped", confidence: 1, detected_by: "style", confirmed: true },
    ] as unknown as Parameters<typeof ImportProgress>[0]["headings"];
    renderWithIntl(
      <ImportProgress doc={doc({})} sections={[sec("feature:@B0040"), sec("custom:CS02"), sec("fixed:1", "done"), sec("fixed:2.1")]} headings={headings} onResume={() => {}} />
    );
    const paper = screen.getByRole("region", { name: "Tài liệu của bạn" });
    const rows = Array.from(paper.querySelectorAll("li")).map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("1. Product Overview");
    expect(rows[1]).toContain("2.1 Actors");
    expect(rows[2]).toContain("3.2 Ordering");
    expect(paper.textContent).not.toMatch(/custom:|feature:|@B\d/);
  });

  it("FLF-411 U1-2: khung mẫu / chế độ 3-4 không nói \"bản gốc 0.1\"; chế độ 1 vẫn nói", () => {
    const { container, unmount } = renderWithIntl(<ImportProgress doc={doc({})} sections={[]} resolvedMode={3} fileKind="template" onResume={() => {}} />);
    expect(container.textContent).not.toContain("0.1");
    expect(container.textContent).toContain("Đánh dấu các mục của khung mẫu");
    unmount();
    const m4 = renderWithIntl(<ImportProgress doc={doc({})} sections={[]} resolvedMode={4} fileKind="written" onResume={() => {}} />);
    expect(m4.container.textContent).not.toContain("0.1");
    m4.unmount();
    const m1 = renderWithIntl(<ImportProgress doc={doc({})} sections={[]} resolvedMode={1} fileKind="written" onResume={() => {}} />);
    expect(m1.container.textContent).toContain("Ghép thành bản gốc 0.1");
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
