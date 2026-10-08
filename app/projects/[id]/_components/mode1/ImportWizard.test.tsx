import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import ImportWizard from "./ImportWizard";
import { confirmLatest, getImport, patchFields, patchMapping, startExtraction, uploadImport } from "@/lib/api/import";

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

const renderWizard = () => renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={5} />);

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
    const value = screen.getByLabelText("Giá trị Tác nhân A02 — Loại");
    fireEvent.change(value, { target: { value: "system" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));

    fireEvent.click(await screen.findByRole("button", { name: "Tạo baseline 0.0" }));
    // Xong baseline 0.0 ⇒ sang màn Tài liệu & version, popup gap report mở sẵn
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}?panel=gap`));
    expect(mode1State.mode1State.reviewFields[0]).toMatchObject({ confirmed: true, edited_value: "system" });
    expect(mode1State.mode1State.project.import_state).toBe("gap_review");
    // không sửa Record of Changes ⇒ không gửi, BE đọc lại từ file (FLF-252)
    expect(mode1State.mode1State.finalizedRecordOfChanges).toBeNull();
  });

  it("FLF-252: bước baseline hiện Record of Changes đọc từ file; không sửa ⇒ không gửi, sửa ⇒ gửi kèm finalize", async () => {
    fireEvent.click(await uploadAndMap());
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));

    expect(await screen.findByText(/Đọc được 1 dòng lịch sử thay đổi từ file/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mô tả dòng 1"), { target: { value: "Tạo tài liệu (bản đầu)" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo baseline 0.0" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}?panel=gap`));
    expect(mode1State.mode1State.finalizedRecordOfChanges).toEqual([
      { date: "01/05/2026", version: "0.1", change_type: "A", in_charge: "Nhóm 1", description: "Tạo tài liệu (bản đầu)" },
    ]);
  });

  it("FLF-265: sau khi trích hiện ngôn ngữ tài liệu nhận diện từ file (chỉ đọc); bước mapping chưa hiện", async () => {
    const start = await uploadAndMap();
    expect(screen.queryByText(/Ngôn ngữ tài liệu/)).toBeNull();
    mode1State.mode1State.profile!.language = "vi";
    fireEvent.click(start);

    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Việt (nhận diện từ file)");
    expect(screen.queryByRole("radio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));
    expect(await screen.findByRole("button", { name: "Tạo baseline 0.0" })).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Tiếng Việt");
  });

  it("FLF-265: file tiếng Anh ⇒ hiện Tiếng Anh", async () => {
    fireEvent.click(await uploadAndMap());
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Anh (nhận diện từ file)");
  });

  it("FLF-265: ngôn ngữ lạ / thiếu ⇒ coi là Tiếng Anh như BE (D1)", async () => {
    const start = await uploadAndMap();
    mode1State.mode1State.profile!.language = "fr";
    fireEvent.click(start);
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Anh (nhận diện từ file)");
  });

  it("FLF-265: bước checking vẫn hiện ngôn ngữ nhận diện", async () => {
    const start = await uploadAndMap();
    mode1State.mode1State.profile!.language = "vi";
    fireEvent.click(start);
    expect(await screen.findByText("Xem lại field độ tin thấp")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả field" }));
    const baseline = await screen.findByRole("button", { name: "Tạo baseline 0.0" });
    expect(screen.getByText(/Đọc được 1 dòng lịch sử thay đổi từ file/)).toBeInTheDocument();

    // Giữ import ở `checking`: finalize đẩy trạng thái rồi trả lỗi conflict ⇒ wizard đọc lại, không chuyển trang
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/import/finalize`, () => {
        mode1State.mode1State.importDoc!.status = "checking";
        mode1State.mode1State.project.import_state = "checking";
        return HttpResponse.json(
          { data: null, error: { code: "SPINE_VERSION_CONFLICT", message: "Spine đã đổi" } },
          { status: 409 }
        );
      })
    );
    fireEvent.click(baseline);

    expect(await screen.findByRole("listitem", { current: "step" })).toHaveTextContent("Baseline & kiểm");
    // Record of Changes chỉ hiện ở `baselining` ⇒ biến mất nghĩa là đã sang `checking`
    await waitFor(() => expect(screen.queryByText(/Đọc được 1 dòng lịch sử thay đổi từ file/)).toBeNull());
    expect(screen.getByText(/Ngôn ngữ tài liệu:/)).toHaveTextContent("Ngôn ngữ tài liệu: Tiếng Việt (nhận diện từ file)");
    expect(push).not.toHaveBeenCalled();
  });

  it("baseline chạy nền (§4.16): bấm tạo ⇒ hiện 'Đang tạo bản gốc và kiểm tra tài liệu…', ẩn nút + Record of Changes", async () => {
    // dựng sẵn tới baselining qua API mock, rồi poll chậm để thấy trạng thái đang chạy
    const id = (await uploadImport(P, docx())).data!.import.id;
    await confirmLatest(P, id);
    await patchMapping(P, { import_id: id, confirm_all: true });
    await startExtraction(P, id);
    for (let i = 0; i < 50 && (await getImport(P)).data!.import!.status === "extracting"; i++);
    await patchFields(P, { import_id: id, confirm_all: true });
    renderWithIntl(<ImportWizard projectId={P} credits={100} pollMs={60_000} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tạo baseline 0.0" }));
    expect(await screen.findByText("Đang tạo bản gốc và kiểm tra tài liệu…")).toBeInTheDocument();
    expect(screen.getByText(/có thể rời trang, việc vẫn chạy tiếp/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo baseline 0.0" })).not.toBeInTheDocument();
    expect(screen.queryByText(/dòng lịch sử thay đổi từ file/)).not.toBeInTheDocument();
    // lần đọc lại ngay sau #8 đã qua chặng tạo bản gốc (mock chạy một chặng mỗi lần đọc) ⇒ đang kiểm tra, vẫn poll
    expect(screen.getByText(/Đã tạo bản gốc 0.0, đang kiểm tra/)).toBeInTheDocument();
    expect(mode1State.mode1State.importDoc?.status).toBe("checking");
    expect(push).not.toHaveBeenCalled();
  });

  it("1.11 hết credit trong job nền ⇒ dừng ở checking, banner kiểm tra; nạp rồi Tiếp tục ⇒ sang gap report", async () => {
    fireEvent.click(await uploadAndMap());
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận tất cả field" }));
    const create = await screen.findByRole("button", { name: "Tạo baseline 0.0" });
    mode1State.mode1State.credits = 0;
    fireEvent.click(create);
    expect(await screen.findByText(/Kiểm tra đang tạm dừng — hết credit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo baseline 0.0" })).not.toBeInTheDocument();
    expect(mode1State.mode1State.importDoc?.status).toBe("checking");
    mode1State.mode1State.credits = 100;
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}?panel=gap`));
    expect(mode1State.mode1State.baselines.filter((b) => b.type === "imported")).toHaveLength(1);
  });

  it("tạo bản gốc lỗi giữa chừng ⇒ banner 'bị gián đoạn' ở baselining; Tiếp tục chạy lại tới gap report", async () => {
    fireEvent.click(await uploadAndMap());
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận tất cả field" }));
    mode1State.mode1State.failNextFinalize = true;
    fireEvent.click(await screen.findByRole("button", { name: "Tạo baseline 0.0" }));
    expect(await screen.findByText(/Tạo bản gốc đang tạm dừng — bị gián đoạn/)).toBeInTheDocument();
    expect(screen.getByText(/dữ liệu đã được đưa về như trước bước này/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${P}?panel=gap`));
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

  it("file lớn hơn 40 MB bị chặn ở FE, không gọi API", async () => {
    renderWizard();
    const big = docx("big.docx");
    Object.defineProperty(big, "size", { value: 41 * 1024 * 1024 });
    fireEvent.change(await screen.findByTestId("docx-input"), { target: { files: [big] } });
    expect(await screen.findByText(/lớn hơn giới hạn 40 MB/)).toBeInTheDocument();
    expect(mode1State.mode1State.importDoc).toBeNull();
  });

  it("bước upload báo trước: in lại theo cấu trúc file gốc, không giữ định dạng Word, file gốc tải lại được", async () => {
    renderWizard();
    await screen.findByTestId("docx-input");
    expect(screen.getByText("không giữ định dạng Word")).toBeInTheDocument();
    expect(screen.getByText(/File gốc luôn tải lại được/)).toBeInTheDocument();
  });
});
