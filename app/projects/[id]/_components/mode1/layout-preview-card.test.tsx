import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { confirmLayoutPreview, getLayoutPreview } from "@/lib/api/import";
import type { LayoutPreview } from "@/types/import";
import LayoutPreviewCard from "./layout-preview-card";

vi.mock("@/lib/api/import", () => ({ getLayoutPreview: vi.fn(), confirmLayoutPreview: vi.fn() }));

const PREVIEW: LayoutPreview = {
  applicable: true,
  confirmed_at: null,
  sections: [
    { section_id: "fixed:1", title: "1 Giới thiệu", level: 1, origin: "file" },
    { section_id: "fixed:V.5", title: "Thuật ngữ", level: 1, origin: "added" },
    { section_id: "custom:c1", title: "Dự toán chi phí", level: 1, origin: "out_of_scope" },
  ],
};
const ok = (data: LayoutPreview) => ({ data }) as never;

beforeEach(() => vi.clearAllMocks());

describe("LayoutPreviewCard (bước 2.9a)", () => {
  it("hiện bố cục mới: mục soạn thêm và mục Ngoài phạm vi xuống cuối; chưa gọi xác nhận cho tới khi bấm", async () => {
    vi.mocked(getLayoutPreview).mockResolvedValue(ok(PREVIEW));
    renderWithIntl(<LayoutPreviewCard projectId="p1" />);
    expect(await screen.findByText("Dự toán chi phí")).toBeInTheDocument();
    expect(screen.getByText("Soạn thêm")).toBeInTheDocument();
    expect(screen.getByText("Ngoài phạm vi, chuyển xuống cuối")).toBeInTheDocument();
    expect(confirmLayoutPreview).not.toHaveBeenCalled();
  });

  it("BF 2.9a: chưa soạn xong (ready = false) ⇒ không hiện thẻ; soạn xong và số mục còn lại đổi ⇒ tải lại rồi hiện", async () => {
    vi.mocked(getLayoutPreview).mockResolvedValueOnce(ok({ ...PREVIEW, ready: false, remaining: 2 })).mockResolvedValue(ok({ ...PREVIEW, ready: true, remaining: 0 }));
    const { rerender } = renderWithIntl(<LayoutPreviewCard projectId="p1" refreshKey={2} />);
    await waitFor(() => expect(getLayoutPreview).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Xác nhận bố cục" })).not.toBeInTheDocument();
    rerender(<LayoutPreviewCard projectId="p1" refreshKey={0} />);
    expect(await screen.findByRole("button", { name: "Xác nhận bố cục" })).toBeInTheDocument();
    expect(getLayoutPreview).toHaveBeenCalledTimes(2);
  });

  it("bấm Xác nhận bố cục ⇒ gọi xác nhận một lần rồi báo đã xác nhận", async () => {
    vi.mocked(getLayoutPreview).mockResolvedValue(ok(PREVIEW));
    vi.mocked(confirmLayoutPreview).mockResolvedValue(ok({ ...PREVIEW, confirmed_at: "2026-11-26T00:00:00.000Z" }));
    renderWithIntl(<LayoutPreviewCard projectId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận bố cục" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã xác nhận bố cục"));
    expect(confirmLayoutPreview).toHaveBeenCalledTimes(1);
  });

  it("xác nhận lỗi ⇒ báo lỗi, giữ nút để thử lại", async () => {
    vi.mocked(getLayoutPreview).mockResolvedValue(ok(PREVIEW));
    vi.mocked(confirmLayoutPreview).mockRejectedValue(new Error("x"));
    renderWithIntl(<LayoutPreviewCard projectId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận bố cục" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận được bố cục");
    expect(screen.getByRole("button", { name: "Xác nhận bố cục" })).toBeEnabled();
  });

  it("không hiện khi không áp dụng (chế độ khác) hoặc đã xác nhận", async () => {
    vi.mocked(getLayoutPreview).mockResolvedValue(ok({ applicable: false, confirmed_at: null, sections: [] }));
    const first = renderWithIntl(<LayoutPreviewCard projectId="p1" />);
    await waitFor(() => expect(getLayoutPreview).toHaveBeenCalled());
    expect(first.container).toBeEmptyDOMElement();
    vi.mocked(getLayoutPreview).mockResolvedValue(ok({ ...PREVIEW, confirmed_at: "2026-11-26T00:00:00.000Z" }));
    const second = renderWithIntl(<LayoutPreviewCard projectId="p2" />);
    await waitFor(() => expect(getLayoutPreview).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });
});
