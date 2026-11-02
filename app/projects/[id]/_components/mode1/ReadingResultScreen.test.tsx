import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { TargetStructure } from "@/types/import";
import ReadingResultScreen from "./ReadingResultScreen";

const P = "650000000000000000000002";

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
  it("chế độ 4: nói số mục thiếu / đã có, bản đồ mục có / sẽ soạn / ngoài phạm vi kèm bước soạn; Hoàn thiện gọi onComplete", () => {
    const onComplete = vi.fn();
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={onComplete} />);
    expect(screen.getByText(/còn thiếu 2 mục của mẫu chuẩn FlintFlow \(1 mục đã có\)/)).toBeInTheDocument();
    const map = screen.getByRole("list", { name: "Bản đồ mục so với cấu trúc đích" });
    expect(map).toHaveTextContent("Có1. Product Overview");
    expect(map).toHaveTextContent("Sẽ soạn2.1 Actorsbước S-2.1");
    expect(map).toHaveTextContent("Ngoài phạm viPhụ lục Dự toán");
    expect(screen.getByText(/1 mục ngoài phạm vi giữ nguyên văn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thiện" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("chế độ 3: câu riêng cho mẫu cố định; Dừng ⇒ tải gap report docx", async () => {
    let downloaded = 0;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/gap-report`, () => {
        downloaded += 1;
        return new HttpResponse(new Blob(["PK"]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="gap.docx"' } });
      })
    );
    const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure({ resolved_mode: 3, target: "template", intent: "fixed", sections: structure().sections.filter((s) => s.status !== "out_of_scope") })} onComplete={vi.fn()} />);
    expect(screen.getByText(/mẫu cố định còn 2 mục trống/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dừng, tải gap report" }));
    await waitFor(() => expect(downloaded).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Dừng, tải gap report" })).toBeEnabled());
    urlSpy.mockRestore();
  });

  it("đang chốt ⇒ hai nút khoá", () => {
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Đang chốt bản gốc…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dừng, tải gap report" })).toBeDisabled();
  });
});

describe("ReadingResultScreen — Luồng 2 cho phần thiếu (FLF-278 trên FLF-336)", () => {
  it("chế độ 3 + có onDraftMissing ⇒ nút Viết phần còn thiếu là lối chính, Hoàn thiện vẫn còn; chế độ 4 không có nút", () => {
    const onDraftMissing = vi.fn();
    const fixed = structure({ resolved_mode: 3, target: "template", intent: "fixed" });
    const { unmount } = renderWithIntl(<ReadingResultScreen projectId={P} structure={fixed} onComplete={vi.fn()} onDraftMissing={onDraftMissing} />);
    expect(screen.getByText(/AI dựng Brief từ phần đã có/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Viết phần còn thiếu với FlintFlow" }));
    expect(onDraftMissing).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Hoàn thiện" })).toBeInTheDocument();
    unmount();
    renderWithIntl(<ReadingResultScreen projectId={P} structure={structure()} onComplete={vi.fn()} onDraftMissing={onDraftMissing} />);
    expect(screen.queryByRole("button", { name: "Viết phần còn thiếu với FlintFlow" })).not.toBeInTheDocument();
  });
});
