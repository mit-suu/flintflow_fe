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

  it("FLF-455: có mục Ngoài phạm vi ⇒ khối riêng nêu tên mục và nói rõ giữ nguyên; không có mục nào ⇒ không hiện khối", () => {
    const { container, unmount } = renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={null} credits={10} {...handlers()} />);
    const note = screen.getByRole("region", { name: "Ngoài phạm vi" });
    expect(note).toHaveTextContent("ISO/IEC/IEEE 29148");
    expect(note).toHaveTextContent("giữ nguyên chữ, không soạn, không kiểm tra");
    expect(screen.getByRole("list", { name: "Các mục ngoài phạm vi" })).toHaveTextContent("Budget");
    expect(container.textContent).not.toMatch(/FPT|—/);
    unmount();
    const none: Preview = { ...preview, summary: { ...preview.summary, out_of_scope: 0 }, sections: preview.sections.filter((s) => s.status !== "out_of_scope") };
    renderWithIntl(<StructurePreview fileName="SRS.docx" preview={none} estimate={null} credits={10} {...handlers()} />);
    expect(screen.queryByRole("region", { name: "Ngoài phạm vi" })).not.toBeInTheDocument();
  });

  it("FLF-455: khối Ngoài phạm vi bản tiếng Anh không lẫn chữ Việt", () => {
    const en = renderWithIntl(<StructurePreview fileName="SRS.docx" preview={preview} estimate={null} credits={10} {...handlers()} />, "en");
    expect(screen.getByRole("region", { name: "Out of scope" })).toHaveTextContent("ISO/IEC/IEEE 29148");
    expect(vietnameseLeftovers(en.container)).toEqual([]);
  });

  it("P09 (#15): mục có trích đoạn ⇒ hiện chữ FlintFlow đọc được (không phải thanh xám); mục còn trống không có chữ", () => {
    const withExcerpt: Preview = {
      ...preview,
      sections: preview.sections.map((s) =>
        s.section_id === "fixed:1" ? { ...s, excerpt: "Lumen is a course management SaaS for small training centres." } : s
      ),
    };
    renderWithIntl(<StructurePreview fileName="SRS.docx" preview={withExcerpt} estimate={null} credits={10} {...handlers()} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Lumen is a course management SaaS for small training centres.");
    expect(rows[1].textContent).not.toContain("Lumen");
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
    // Tên chung "Mục riêng" ở bản đồ mục và ở khối Ngoài phạm vi (FLF-455), không in mã nội bộ
    expect(screen.getAllByText("Mục riêng")).toHaveLength(2);
  });

  it("FLF-463: nhãn Khung mẫu mà còn mục đã viết ⇒ vẫn nói đọc phần đã có rồi soạn mục còn thiếu, không nói \"chưa có nội dung để đọc\"", () => {
    const partial: Preview = { ...preview, summary: { present: 1, missing: 5, out_of_scope: 0, kind: "template" }, resolved_mode: 3 };
    const { container } = renderWithIntl(<StructurePreview fileName="Mau_SRS_SoXD.docx" preview={partial} estimate={null} credits={5} {...handlers()} />);
    expect(screen.getByRole("heading", { name: /Khung mẫu · 1\/6/ })).toBeInTheDocument();
    expect(container.textContent).toContain("Còn 5 mục trống. FlintFlow đọc phần đã có");
    expect(container.textContent).not.toMatch(/chưa có nội dung để đọc/);
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

  it("FLF-454: kiểm tra AI đang chạy ⇒ nút Dừng gọi onPause; Dừng ở bước kiểm tra ⇒ thẻ Đã dừng + Tiếp tục", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const { unmount } = renderWithIntl(<ImportProgress doc={doc({ status: "checking" })} sections={[]} onResume={onResume} onPause={onPause} />);
    fireEvent.click(screen.getByRole("button", { name: /Dừng đọc/ }));
    expect(onPause).toHaveBeenCalled();
    unmount();

    renderWithIntl(<ImportProgress doc={doc({ status: "checking", paused: { reason: "user", at: "2026-11-08T00:00:00.000Z" } })} sections={[]} onResume={onResume} onPause={onPause} />);
    expect(screen.getByRole("status")).toHaveTextContent("Đã dừng bước kiểm tra AI");
    expect(screen.queryByRole("button", { name: /Dừng đọc/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onResume).toHaveBeenCalled();
  });

  it("FLF-454: checking dừng để báo lại credit 1.9 ⇒ thẻ có số credit mới + nút Xác nhận và tiếp tục (không phải thẻ người dùng tự Dừng)", () => {
    const onResume = vi.fn();
    const estimate = { text_batches: 0, diagram_images: 0, ai_calls: 3, credits: 14, available_credits: 100 };
    renderWithIntl(<ImportProgress doc={doc({ status: "checking", paused: { reason: "credit_notice", at: "2026-11-08T00:00:00.000Z" } })} sections={[]} creditEstimate={estimate} onResume={onResume} onPause={() => {}} />);
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("tốn 14 credit");
    expect(card).not.toHaveTextContent("Đã dừng");
    expect(screen.queryByRole("button", { name: /Dừng đọc/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và tiếp tục" }));
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

  it("FLF-411 U2-8: có danh sách mục của màn đọc khung ⇒ đếm đúng tập đó (heading tính năng không tính), mục lỗi vẫn hiện", () => {
    const sec = (section_id: string, status: "done" | "pending" | "failed" = "pending") => ({ section_id, status, fields_total: 0, fields_needing_review: 0, error: null });
    renderWithIntl(
      <ImportProgress
        doc={doc({})}
        sections={[sec("feature:@B0383", "done"), sec("fixed:1", "done"), sec("function:@B0384"), sec("feature:@B0439", "failed")]}
        previewSectionIds={["fixed:1", "function:@B0384"]}
        onResume={() => {}}
      />
    );
    expect(screen.getByText("mục đã đọc").parentElement).toHaveTextContent("1/2");
    const paper = screen.getByRole("region", { name: "Tài liệu của bạn" });
    expect(paper.querySelectorAll("li")).toHaveLength(3);
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
