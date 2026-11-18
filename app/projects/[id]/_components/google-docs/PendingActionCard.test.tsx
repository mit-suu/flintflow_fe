import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import type { DocsAgentPendingAction } from "@/lib/api/google-docs-agent";

const h = vi.hoisted(() => ({ apply: vi.fn(), dismiss: vi.fn() }));
vi.mock("@/lib/api/google-docs-agent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyDocsAgentAction: h.apply,
  dismissDocsAgentAction: h.dismiss,
}));

const { default: PendingActionCard } = await import("./PendingActionCard");

const replace: DocsAgentPendingAction = {
  id: "a1",
  tool: "replace_text",
  documentId: "doc-1",
  args: { find: "khách hàng", replace: "người dùng", matchCase: true },
  preview: { matches: 3, samples: [{ heading: "2.1 Use cases", before: "khách hàng chọn chuyến", after: "người dùng chọn chuyến" }] },
  expiresAt: "2026-11-17T16:00:00.000Z",
};
const insert: DocsAgentPendingAction = {
  id: "a2",
  tool: "insert_text",
  documentId: "doc-1",
  args: { afterHeading: "Business Rules", text: "BR02: Hoàn vé trước 24 giờ.\nBR03: Đổi vé một lần.", asHeading: false },
  preview: { location: "2.2 Business Rules", text: "BR02: Hoàn vé trước 24 giờ.\nBR03: Đổi vé một lần.", asHeading: false, headingLevel: null },
  expiresAt: "2026-11-17T16:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("PendingActionCard", () => {
  it("thay chữ: tiêu đề có số chỗ khớp, dòng -/+ và mẫu trước/sau; Áp dụng ⇒ gọi API, hiện Đã áp dụng + link", async () => {
    h.apply.mockResolvedValue({ applied: true });
    renderWithIntl(<PendingActionCard projectId="p1" action={replace} index={1} />);

    expect(screen.getByText("Đề xuất #1 · Thay chữ (3 chỗ)")).toBeInTheDocument();
    expect(screen.getByText("- khách hàng")).toBeInTheDocument();
    expect(screen.getByText("+ người dùng")).toBeInTheDocument();
    expect(screen.getByText("2.1 Use cases")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText(/Đã áp dụng/)).toBeInTheDocument();
    expect(h.apply).toHaveBeenCalledWith("p1", "a1");
    expect(screen.getByRole("link", { name: /Mở tài liệu/ })).toHaveAttribute("href", "https://docs.google.com/document/d/doc-1/edit");
  });

  it("chèn: tiêu đề nêu mục, mỗi dòng có dấu +", () => {
    renderWithIntl(<PendingActionCard projectId="p1" action={insert} index={2} />);
    expect(screen.getByText('Đề xuất #2 · Chèn vào cuối "2.2 Business Rules"')).toBeInTheDocument();
    expect(screen.getByText(/\+ BR02: Hoàn vé trước 24 giờ\.\s+\+ BR03/)).toBeInTheDocument();
  });

  it("tài liệu đã đổi ⇒ câu nhờ trợ lý xem lại, vẫn còn nút; hết hạn ⇒ câu riêng", async () => {
    h.apply.mockRejectedValueOnce(new ApiClientError(409, "GOOGLE_DOC_CHANGED", "x"));
    renderWithIntl(<PendingActionCard projectId="p1" action={replace} index={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText(/Nhờ trợ lý xem lại/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeEnabled();

    h.apply.mockRejectedValueOnce(new ApiClientError(404, "PENDING_ACTION_NOT_FOUND", "x"));
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText(/quá 1 giờ/)).toBeInTheDocument();
  });

  it("Bỏ qua ⇒ gọi API, thẻ thu thành một dòng", async () => {
    h.dismiss.mockResolvedValue({ dismissed: true });
    renderWithIntl(<PendingActionCard projectId="p1" action={insert} index={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(await screen.findByText("Đã bỏ qua đề xuất #2.")).toBeInTheDocument();
    expect(h.dismiss).toHaveBeenCalledWith("p1", "a2");
    expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument();
  });
});
