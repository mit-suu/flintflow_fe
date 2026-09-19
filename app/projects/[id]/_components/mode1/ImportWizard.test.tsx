import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import ImportWizard from "./ImportWizard";

const P = MODE1_PROJECT_ID;
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  push.mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const docx = (name = "SRS_Lumen.docx") =>
  new File(["PK mock"], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

const renderWizard = () => render(<ImportWizard projectId={P} credits={100} pollMs={5} />);

/** Upload → xác nhận bản mới nhất → mapping; dừng ở màn trích. */
const uploadAndMap = async () => {
  renderWizard();
  fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [docx()] } });
  fireEvent.click(await screen.findByRole("button", { name: "Đúng, đây là bản mới nhất" }));
  expect(await screen.findByText("Xác nhận mapping heading → section")).toBeInTheDocument();
  // Mặc định chỉ hiện dòng độ tin thấp: heading 3.2.4 (62%) và phụ lục không khớp (30%)
  expect(screen.getByText("3.2.4 Log out of system", { selector: "td div" })).toBeInTheDocument();
  expect(screen.queryByText("1 Product Overview", { selector: "td div" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận mapping" }));
  return screen.findByRole("button", { name: "Bắt đầu trích (AI)" });
};

describe("ImportWizard — luồng 1.1–1.12 trên mock", () => {
  it("đi trọn: upload → xác nhận → mapping → trích nền (poll) → field → baseline ⇒ sang gap report", async () => {
    fireEvent.click(await uploadAndMap());

    // I-4 chạy nền: #6 trả ngay, tiến độ tăng qua poll GET /import tới khi sang fields_review
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    const value = screen.getByLabelText("Giá trị actors[id=A02].kind");
    fireEvent.change(value, { target: { value: "system" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));

    fireEvent.click(await screen.findByRole("button", { name: "Tạo baseline 0.0" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}/gap-report`));
    expect(mode1State.mode1State.reviewFields[0]).toMatchObject({ confirmed: true, edited_value: "system" });
    expect(mode1State.mode1State.project.import_state).toBe("gap_review");
  });

  it("hết credit giữa lúc trích ⇒ banner paused; nạp xong bấm Tiếp tục chạy nốt", async () => {
    const start = await uploadAndMap();
    mode1State.mode1State.credits = 4; // đủ 2 section
    fireEvent.click(start);

    expect(await screen.findByText(/Trích field đang tạm dừng — hết credit/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");

    mode1State.mode1State.credits = 100;
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
  });

  it("preflight từ chối ⇒ danh sách lỗi kèm vị trí và cách sửa, cho tải file đã sửa", async () => {
    const rejected = {
      id: "66f000000000000000000001",
      project_id: P,
      original_name: "SRS_tracked.docx",
      size: 10,
      sha256: "a".repeat(64),
      status: "preflight_rejected",
      preflight: {
        status: "rejected",
        issues: [{ code: "FOREIGN_TRACK_CHANGE", message: "Track Changes của \"Nguyen Van A\" chưa được Accept/Reject", location: { block_ord: 5, text: "3.2.5 Create SRS project" } }],
      },
      stamp: null,
      confirmed_latest_at: null,
      paused: null,
      extract_cursor: null,
      created_at: "2026-09-19T00:00:00.000Z",
      updated_at: "2026-09-19T00:00:00.000Z",
    };
    let uploaded = false;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/import`, () => {
        uploaded = true;
        return HttpResponse.json(
          { data: null, meta: { import_id: rejected.id, issues: rejected.preflight.issues }, error: { code: "IMPORT_FILE_REJECTED", message: "File chưa nhập được" } },
          { status: 422 }
        );
      }),
      http.get(`${API_BASE_URL}/projects/:projectId/import`, () =>
        HttpResponse.json({ data: { import: uploaded ? rejected : null, profile: null, extraction: { sections: [], review_fields: [] }, blocks_count: 0 }, error: null })
      )
    );
    renderWizard();
    fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [docx("SRS_tracked.docx")] } });

    expect(await screen.findByText("Track Changes chưa xử lý")).toBeInTheDocument();
    expect(screen.getByText(/đoạn thứ 5 — “3.2.5 Create SRS project”/)).toBeInTheDocument();
    expect(screen.getByText(/Accept\/Reject tất cả thay đổi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lên file đã sửa" })).toBeInTheDocument();
  });

  it("file lớn hơn 10MB bị chặn ở FE, không gọi API", async () => {
    renderWizard();
    const big = docx("big.docx");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [big] } });
    expect(await screen.findByText(/lớn hơn 10MB/)).toBeInTheDocument();
    expect(mode1State.mode1State.importDoc).toBeNull();
  });
});
