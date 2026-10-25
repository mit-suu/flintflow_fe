import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { MESSAGES, renderWithIntl } from "@/test/intl";
import type { Spine } from "@/types/spine";
import type { RequirementSource } from "@/types/sources";
import SourcesPanel from "./SourcesPanel";
import { paragraphLabel, sourceEntityLabel } from "./source-labels";

const spine = {
  project: { vision: "Sell online" },
  use_cases: [{ id: "UC03", name: "Place order" }],
  nfrs: [{ id: "N03", statement: "Checkout completes within 3 seconds." }],
  assumptions: [
    { id: "AS1", status: "unconfirmed" },
    { id: "AS2", status: "confirmed" },
  ],
} as unknown as Spine;

const sources: RequirementSource[] = [
  {
    path: "nfrs[id=N03]",
    step_id: "S-6.4",
    updated_at: "2026-10-17T00:00:00.000Z",
    refs: [{ para_id: "D1-P03", document_id: "d1", document_name: "bien-ban.docx", quote: "Trang thanh toán phải xong trong 3 giây." }],
  },
  {
    path: "use_cases[id=UC03]",
    step_id: "S-3.2",
    updated_at: "2026-10-17T00:00:00.000Z",
    refs: [{ para_id: "D2-P01", document_id: "d2", document_name: null, quote: "Khách đặt hàng trên app." }],
  },
];

describe("SourcesPanel — nguồn tài liệu của yêu cầu (FLF-292)", () => {
  it("nhóm theo loại (use case trước), hiện chữ gốc, tên tài liệu và số đoạn", () => {
    renderWithIntl(<SourcesPanel spine={spine} sources={sources} loading={false} error={null} />);

    expect(screen.getByText("2 mục có nguồn từ tài liệu")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["Use case (1)", "Yêu cầu phi chức năng (1)"]);

    const nfr = within(screen.getByRole("region", { name: "Yêu cầu phi chức năng" }));
    expect(nfr.getByText("N03")).toBeInTheDocument();
    expect(nfr.getByText("Checkout completes within 3 seconds.", { exact: false })).toBeInTheDocument();
    expect(nfr.getByText("Trang thanh toán phải xong trong 3 giây.")).toBeInTheDocument();
    expect(nfr.getByText("bien-ban.docx · đoạn 3")).toBeInTheDocument();
    // Tài liệu đã xoá: chữ trích vẫn còn
    expect(screen.getByText("Tài liệu đã xoá · đoạn 1")).toBeInTheDocument();
  });

  it("đếm điều AI còn tự giả định (chưa xác nhận)", () => {
    renderWithIntl(<SourcesPanel spine={spine} sources={sources} loading={false} error={null} />);
    expect(screen.getByText(/1 điều AI đang tự giả định/)).toBeInTheDocument();
  });

  it("chưa có nguồn ⇒ hướng dẫn đính kèm tài liệu ở khung chat", () => {
    renderWithIntl(<SourcesPanel spine={spine} sources={[]} loading={false} error={null} />);
    expect(screen.getByText(/Đính kèm biên bản họp, email hoặc transcript/)).toBeInTheDocument();
  });

  it("lỗi tải ⇒ hiện thông báo lỗi", () => {
    renderWithIntl(<SourcesPanel spine={spine} sources={[]} loading={false} error="Không tải được nguồn tài liệu" />);
    expect(screen.getByText("Không tải được nguồn tài liệu")).toBeInTheDocument();
  });
});

describe("source-labels", () => {
  const t = createTranslator({ locale: "vi", messages: MESSAGES.vi, namespace: "workspace.sources" });
  const tEn = createTranslator({ locale: "en", messages: MESSAGES.en, namespace: "workspace.sources" });
  it("path ⇒ loại + mã + chữ người đọc được; field của project ⇒ tên field", () => {
    expect(sourceEntityLabel(spine, "use_cases[id=UC03]", t)).toEqual({ kind: "use_cases", kindLabel: "Use case", id: "UC03", title: "Place order" });
    expect(sourceEntityLabel(spine, "project.vision", t)).toEqual({ kind: "project", kindLabel: "Thông tin dự án", id: "", title: "Tầm nhìn" });
    expect(sourceEntityLabel(spine, "functions[id=FN9]", t).title).toBe("");
  });

  it("mã đoạn ⇒ 'đoạn n'; sai khuôn ⇒ giữ nguyên", () => {
    expect(paragraphLabel("D1-P03", t)).toBe("đoạn 3");
    expect(paragraphLabel("D12-P105", t)).toBe("đoạn 105");
    expect(paragraphLabel("K1", t)).toBe("K1");
    expect(paragraphLabel("D1-P03", tEn)).toBe("paragraph 3");
  });
});
