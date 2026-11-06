import { fireEvent, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockServer } from "@/mocks/server";
import type { TargetStructure } from "@/types/import";
import ReadingResultScreen from "./ReadingResultScreen";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const structure = (over: Partial<TargetStructure> = {}): TargetStructure => ({
  target: "fpt",
  intent: "free",
  resolved_mode: 4,
  compared_at: "2026-10-27T01:00:00.000Z",
  missing: ["fixed:2.1", "fixed:2.2.2"],
  sections: [
    { section_id: "fixed:1", title: "1. Product Overview", status: "present", owner_steps: ["S-1.2"] },
    { section_id: "fixed:2.1", title: "2.1 Actors", status: "missing", owner_steps: ["S-2.1"] },
    { section_id: "fixed:2.2.2", title: "2.2.2 Use Case Descriptions", status: "missing", owner_steps: ["S-3.1", "S-3.2"] },
    { section_id: "custom:CS01", title: "Phụ lục Dự toán", status: "out_of_scope", owner_steps: [] },
  ],
  ...over,
});

describe("ReadingResultScreen (FLF-336 — điểm dừng Kết quả đọc file)", () => {
  it("chế độ 4 (dự án có sẵn): số mục thiếu / đã có, bản đồ mục có / còn trống / ngoài phạm vi — không có bước soạn; Tiếp tục sửa với FlintFlow gọi onComplete", () => {
    const onComplete = vi.fn();
    renderWithIntl(<ReadingResultScreen structure={structure()} onComplete={onComplete} />);
    expect(screen.getByText(/còn thiếu 2 mục của mẫu chuẩn FlintFlow \(1 mục đã có\)/)).toBeInTheDocument();
    const map = screen.getByRole("list", { name: "Bản đồ mục so với cấu trúc đích" });
    expect(map).toHaveTextContent("Có1. Product Overview");
    // Dự án có sẵn: mục trống bổ sung qua change request, không có bước nào "sẽ soạn"
    expect(map).toHaveTextContent("Còn trống2.1 Actors");
    expect(map).not.toHaveTextContent("bước S-2.1");
    expect(screen.getByText(/giữ nguyên file của bạn làm bản gốc 0\.1 rồi mở chỗ sửa: 2 mục còn trống bổ sung qua chat/)).toBeInTheDocument();
    expect(map).toHaveTextContent("Ngoài phạm viPhụ lục Dự toán");
    expect(screen.getByText(/1 mục ngoài phạm vi giữ nguyên văn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục sửa với FlintFlow" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("chế độ 3: câu riêng cho mẫu cố định của dự án có sẵn; không có nút tải gap report ở bước này (tải ở workspace)", () => {
    renderWithIntl(<ReadingResultScreen structure={structure({ resolved_mode: 3, target: "template", intent: "fixed", sections: structure().sections.filter((s) => s.status !== "out_of_scope") })} onComplete={vi.fn()} />);
    expect(screen.getByText(/File theo mẫu của bạn: 1 mục đã có nội dung, 2 mục còn trống/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gap report/i })).not.toBeInTheDocument();
  });

  it("đang mở chỗ sửa ⇒ nút khoá", () => {
    renderWithIntl(<ReadingResultScreen structure={structure()} onComplete={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Đang mở chỗ sửa…" })).toBeDisabled();
  });
});

describe("ReadingResultScreen — dự án mới theo mẫu bắt buộc (FLF-278)", () => {
  it("có onDraftMissing (không onComplete) ⇒ lời 'đọc mẫu', một lối đi duy nhất Viết với FlintFlow — không Hoàn thiện, không gap report", () => {
    const onDraftMissing = vi.fn();
    const fixed = structure({ resolved_mode: 3, target: "template", intent: "fixed", sections: structure().sections.filter((s) => s.status !== "out_of_scope") });
    renderWithIntl(<ReadingResultScreen structure={fixed} onDraftMissing={onDraftMissing} />);
    expect(screen.getByRole("heading", { name: "Kết quả đọc mẫu" })).toBeInTheDocument();
    expect(screen.getByText(/Mẫu có 1 mục đã có nội dung và 2 mục còn trống/)).toBeInTheDocument();
    expect(screen.getByText(/soạn 2 mục còn trống để bạn duyệt/)).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Viết với FlintFlow"]);
    fireEvent.click(screen.getByRole("button", { name: "Viết với FlintFlow" }));
    expect(onDraftMissing).toHaveBeenCalledTimes(1);
  });

  it("dự án có sẵn (chỉ onComplete) ⇒ một nút Tiếp tục sửa với FlintFlow, không có Viết với FlintFlow", () => {
    renderWithIntl(<ReadingResultScreen structure={structure({ resolved_mode: 3, target: "template", intent: "fixed" })} onComplete={vi.fn()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Tiếp tục sửa với FlintFlow"]);
    expect(screen.getByRole("heading", { name: "Kết quả đọc file" })).toBeInTheDocument();
  });
});
